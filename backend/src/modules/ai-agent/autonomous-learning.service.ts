import { createHash, randomUUID } from 'crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  AgentToolContext,
  AutonomousLearningResult,
  MemoryProposal,
  MemoryType,
  USER_MEMORY_KEYS,
  UserMemoryKey,
} from './tools/agent-tool.types';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';
import { isRuntimeOperationalClaim } from './knowledge-safety.util';

interface NormalizedProposal extends MemoryProposal {
  category: string;
  title: string;
  content: string;
  reason: string;
}

interface KnowledgeRow extends QueryResultRow {
  id: number | string;
  category: string;
  title: string;
  content: string;
  knowledgeType: string;
  scope: string;
  ownerUserId: number | null;
  memoryKey: string | null;
  validationStatus: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
}

interface RecommendationRunRow extends QueryResultRow {
  recommendationRunId: string;
  candidateOptionIds: unknown;
  featureSnapshot: unknown;
  requirementSnapshot: unknown;
  modelVersion: string;
}

interface SourceMessageRow extends QueryResultRow {
  content: string | null;
}

interface InsertedIdRow extends QueryResultRow {
  id: number | string;
}

interface VersionNumberRow extends QueryResultRow {
  versionNumber: number | string;
}

type KnowledgeAction =
  | 'created'
  | 'activated'
  | 'quarantined'
  | 'rejected'
  | 'superseded'
  | 'restored';

const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const USER_MEMORY_KEY_SET = new Set<string>(USER_MEMORY_KEYS);
const MAX_CATEGORY_LENGTH = 50;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;
const MAX_REASON_LENGTH = 1000;

@Injectable()
export class AutonomousLearningService {
  private readonly logger = new Logger(AutonomousLearningService.name);

  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly embeddings?: KnowledgeEmbeddingService,
  ) {}

  async processProposal(
    rawProposal: MemoryProposal,
    context: AgentToolContext,
  ): Promise<AutonomousLearningResult> {
    const proposal = this.normalizeProposal(rawProposal);
    if (!proposal) {
      return this.result(context, rawProposal?.memoryType, {
        status: 'rejected',
        message: 'The memory proposal was invalid or incomplete.',
      });
    }

    try {
      let result: AutonomousLearningResult = {
        status: 'rejected',
        message: 'The memory proposal type is unsupported.',
      };
      switch (proposal.memoryType) {
        case 'user_preference':
          result = await this.storeUserPreference(proposal, context);
          break;
        case 'recommendation_feedback':
          result = await this.storeRecommendationSignal(proposal, context);
          break;
        case 'business_rule':
        case 'faq':
        case 'information_correction':
          result = await this.storeGlobalProposal(proposal, context);
          break;
      }
      if (
        this.embeddings &&
        result.knowledgeEntryId &&
        ['saved_user_memory', 'verified_and_activated'].includes(result.status)
      ) {
        // Vectorization happens only after the validated DB transaction has
        // committed. It is deliberately non-blocking for the chat workflow.
        void this.embeddings
          .embedKnowledgeEntry(result.knowledgeEntryId)
          .catch(() => undefined);
      }
      return this.result(context, proposal.memoryType, result);
    } catch (error) {
      const errorName =
        error instanceof Error ? error.name : 'UnknownPersistenceError';
      this.logger.error(
        JSON.stringify({
          conversationId: context.conversationId ?? null,
          sourceMessageId: context.sourceMessageId ?? null,
          action: proposal.memoryType,
          resultStatus: 'error',
          errorName,
        }),
      );
      return {
        status: 'error',
        message: 'The information could not be persisted.',
      };
    }
  }

  private async storeUserPreference(
    proposal: NormalizedProposal,
    context: AgentToolContext,
  ): Promise<AutonomousLearningResult> {
    if (context.userId === null) {
      return {
        status: 'login_required',
        message: 'Log in to save this preference for future conversations.',
      };
    }

    return this.database.transaction(async (client) => {
      const sourceMessage = await this.sourceMessage(client, context);
      const memoryKey = proposal.memoryKey ?? this.inferMemoryKey(proposal);
      if (
        !sourceMessage ||
        !this.isExplicitPreference(sourceMessage) ||
        (memoryKey === 'consultation_topic_preference' &&
          !this.isDurableConsultationPreference(sourceMessage)) ||
        !this.isSafePreference(proposal.content)
      ) {
        return {
          status: 'rejected',
          message:
            'Only explicit, non-sensitive preferences can be saved persistently.',
        };
      }

      const contentHash = this.hash([
        String(context.userId),
        proposal.memoryType,
        memoryKey,
        this.normalizeForHash(proposal.content),
      ]);

      const duplicateResult = await client.query<InsertedIdRow>(
        `SELECT knowledge_entry_id AS id
         FROM ai_knowledge_entries
         WHERE scope = 'user'
           AND owner_user_id = $1
           AND memory_key = $2
           AND content_hash = $3
           AND is_active = TRUE
           AND validation_status = 'active'
         LIMIT 1
         FOR UPDATE`,
        [context.userId, memoryKey, contentHash],
      );
      const duplicate = duplicateResult.rows[0];
      if (duplicate) {
        return {
          status: 'duplicate',
          message: 'That preference is already active.',
          knowledgeEntryId: Number(duplicate.id),
        };
      }

      const currentResult = await client.query<KnowledgeRow>(
        `${this.knowledgeSelect()}
         WHERE scope = 'user'
           AND owner_user_id = $1
           AND memory_key = $2
           AND is_active = TRUE
           AND validation_status = 'active'
         ORDER BY updated_at DESC, knowledge_entry_id DESC
         LIMIT 1
         FOR UPDATE`,
        [context.userId, memoryKey],
      );
      const previous = currentResult.rows[0] ?? null;
      const previousSnapshot = previous
        ? this.knowledgeSnapshot(previous)
        : null;

      if (previous) {
        await client.query(
          `UPDATE ai_knowledge_entries
           SET is_active = FALSE,
               validation_status = 'superseded',
               validation_reason = $2,
               effective_to = NOW(),
               updated_at = NOW()
           WHERE knowledge_entry_id = $1`,
          [
            previous.id,
            `Replaced by a newer explicit preference for ${memoryKey}.`,
          ],
        );
      }

      const validationReason =
        'Explicit preference from the authenticated account owner.';
      const inserted = await client.query<InsertedIdRow>(
        `INSERT INTO ai_knowledge_entries
           (knowledge_key, category, title, content, knowledge_type,
            source_type, source_reference, scope, owner_user_id, memory_key,
            validation_status, validation_reason, validation_evidence,
            source_role, source_conversation_id, source_message_id,
            content_hash, is_active, effective_from, supersedes_entry_id)
         VALUES
           (NULL, $1, $2, $3, 'user_preference',
            'user_message', $4, 'user', $5, $6,
            'active', $7, $8::jsonb,
            $9, $10, $11, $12, TRUE, NOW(), $13)
         RETURNING knowledge_entry_id AS id`,
        [
          proposal.category,
          proposal.title,
          proposal.content,
          this.sourceReference(context.sourceMessageId),
          context.userId,
          memoryKey,
          validationReason,
          JSON.stringify({
            source: 'authenticated_user_message',
            explicitPreferenceValidated: true,
          }),
          context.role,
          context.conversationId,
          context.sourceMessageId,
          contentHash,
          previous?.id ?? null,
        ],
      );
      const entryId = Number(inserted.rows[0].id);
      const newSnapshot = {
        category: proposal.category,
        title: proposal.title,
        content: proposal.content,
        knowledgeType: 'user_preference',
        scope: 'user',
        ownerUserId: context.userId,
        memoryKey,
        validationStatus: 'active',
        isActive: true,
      };

      if (previous) {
        await this.recordVersion(client, {
          entryId: Number(previous.id),
          action: 'superseded',
          previousSnapshot,
          newSnapshot: {
            ...(previousSnapshot ?? {}),
            validationStatus: 'superseded',
            isActive: false,
          },
          context,
          validationReason: `Superseded by knowledge entry ${entryId}.`,
        });
      }
      await this.recordVersion(client, {
        entryId,
        action: 'activated',
        previousSnapshot: null,
        newSnapshot,
        context,
        validationReason,
      });
      await this.recordAudit(client, {
        entryId,
        entityKey: memoryKey,
        action: previous ? 'ai_user_memory_replaced' : 'ai_user_memory_created',
        previousSnapshot,
        newSnapshot,
        context,
        validationReason,
      });

      return {
        status: 'saved_user_memory',
        message: 'The preference was saved for future conversations.',
        knowledgeEntryId: entryId,
      };
    });
  }

  private async storeGlobalProposal(
    proposal: NormalizedProposal,
    context: AgentToolContext,
  ): Promise<AutonomousLearningResult> {
    return this.database.transaction(async (client) => {
      const sourceMessage = await this.sourceMessage(client, context);
      if (!sourceMessage) {
        return {
          status: 'rejected',
          message: 'A stored source message is required for knowledge updates.',
        };
      }

      const isTrustedAdmin =
        context.userId !== null &&
        context.role !== null &&
        ADMIN_ROLES.has(context.role.toLowerCase());
      if (
        isTrustedAdmin &&
        proposal.memoryType !== 'information_correction' &&
        isRuntimeOperationalClaim(proposal.content)
      ) {
        return {
          status: 'rejected',
          message:
            'Operational rules must be changed through the authoritative backend workflow, not chat knowledge.',
        };
      }
      const canActivate =
        isTrustedAdmin && proposal.memoryType !== 'information_correction';
      const effectiveFrom = this.parseDate(proposal.effectiveFrom);
      const effectiveTo = this.parseDate(proposal.effectiveTo);
      if (
        effectiveFrom === undefined ||
        effectiveTo === undefined ||
        (effectiveFrom && effectiveTo && effectiveFrom >= effectiveTo)
      ) {
        return {
          status: 'rejected',
          message: 'The proposed effective date range is invalid.',
        };
      }

      const globalKey = this.globalKnowledgeKey(proposal);
      const contentHash = this.hash([
        proposal.memoryType,
        this.normalizeForHash(proposal.category),
        this.normalizeForHash(proposal.content),
      ]);
      const duplicateResult = await client.query<InsertedIdRow>(
        `SELECT knowledge_entry_id AS id
         FROM ai_knowledge_entries
         WHERE scope = 'global'
           AND knowledge_type = $1
           AND category = $2
           AND content_hash = $3
           AND validation_status <> 'rejected'
           AND (
             validation_status = 'active'
             OR source_role IS NOT DISTINCT FROM $4
           )
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [proposal.memoryType, proposal.category, contentHash, context.role],
      );
      const duplicate = duplicateResult.rows[0];
      if (duplicate) {
        return {
          status: 'duplicate',
          message: 'That knowledge proposal already exists.',
          knowledgeEntryId: Number(duplicate.id),
        };
      }

      let previous: KnowledgeRow | null = null;
      let previousSnapshot: Record<string, unknown> | null = null;
      if (canActivate) {
        const currentResult = await client.query<KnowledgeRow>(
          `${this.knowledgeSelect()}
           WHERE scope = 'global'
             AND knowledge_type = $1
             AND memory_key = $2
             AND is_active = TRUE
             AND validation_status = 'active'
             AND (effective_to IS NULL OR effective_to > NOW())
           ORDER BY effective_from DESC NULLS LAST,
                    updated_at DESC,
                    knowledge_entry_id DESC
           LIMIT 1
           FOR UPDATE`,
          [proposal.memoryType, globalKey],
        );
        previous = currentResult.rows[0] ?? null;
        previousSnapshot = previous ? this.knowledgeSnapshot(previous) : null;

        if (previous) {
          const beginsInFuture =
            effectiveFrom !== null && effectiveFrom.getTime() > Date.now();
          await client.query(
            beginsInFuture
              ? `UPDATE ai_knowledge_entries
                 SET effective_to = $2,
                     validation_reason = $3,
                     updated_at = NOW()
                 WHERE knowledge_entry_id = $1`
              : `UPDATE ai_knowledge_entries
                 SET is_active = FALSE,
                     validation_status = 'superseded',
                     effective_to = COALESCE($2, NOW()),
                     validation_reason = $3,
                     updated_at = NOW()
                 WHERE knowledge_entry_id = $1`,
            [
              previous.id,
              effectiveFrom,
              `Superseded by a verified administrator update for ${globalKey}.`,
            ],
          );
        }
      }

      const validationStatus = canActivate ? 'active' : 'quarantined';
      const validationReason = this.globalValidationReason(
        proposal.memoryType,
        isTrustedAdmin,
      );
      const sourceType = canActivate
        ? 'trusted_admin'
        : proposal.memoryType === 'information_correction'
          ? 'unverified_claim'
          : 'customer_claim';
      const inserted = await client.query<InsertedIdRow>(
        `INSERT INTO ai_knowledge_entries
           (knowledge_key, category, title, content, knowledge_type,
            source_type, source_reference, scope, owner_user_id, memory_key,
            validation_status, validation_reason, validation_evidence,
            source_role, source_conversation_id, source_message_id,
            content_hash, is_active, effective_from, effective_to,
            supersedes_entry_id)
         VALUES
           (NULL, $1, $2, $3, $4,
            $5, $6, 'global', NULL, $7,
            $8, $9, $10::jsonb,
            $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING knowledge_entry_id AS id`,
        [
          proposal.category,
          proposal.title,
          proposal.content,
          proposal.memoryType,
          sourceType,
          this.sourceReference(context.sourceMessageId),
          globalKey,
          validationStatus,
          validationReason,
          JSON.stringify({
            source: canActivate
              ? 'authenticated_administrator_message'
              : 'unverified_natural_language_claim',
            trustedRoleValidated: canActivate,
          }),
          context.role,
          context.conversationId,
          context.sourceMessageId,
          contentHash,
          canActivate,
          effectiveFrom,
          effectiveTo,
          previous?.id ?? null,
        ],
      );
      const entryId = Number(inserted.rows[0].id);
      const newSnapshot = {
        category: proposal.category,
        title: proposal.title,
        content: proposal.content,
        knowledgeType: proposal.memoryType,
        scope: 'global',
        memoryKey: globalKey,
        validationStatus,
        effectiveFrom,
        effectiveTo,
        isActive: canActivate,
      };

      if (previous) {
        const previousExpiredAtFutureDate =
          effectiveFrom !== null && effectiveFrom.getTime() > Date.now();
        await this.recordVersion(client, {
          entryId: Number(previous.id),
          action: 'superseded',
          previousSnapshot,
          newSnapshot: {
            ...(previousSnapshot ?? {}),
            ...(previousExpiredAtFutureDate
              ? { effectiveTo: effectiveFrom }
              : { validationStatus: 'superseded', isActive: false }),
          },
          context,
          validationReason: `Superseded by knowledge entry ${entryId}.`,
        });
      }
      await this.recordVersion(client, {
        entryId,
        action: canActivate ? 'activated' : 'quarantined',
        previousSnapshot: null,
        newSnapshot,
        context,
        validationReason,
      });
      await this.recordAudit(client, {
        entryId,
        entityKey: globalKey,
        action: canActivate
          ? 'ai_global_knowledge_activated'
          : 'ai_global_knowledge_quarantined',
        previousSnapshot,
        newSnapshot,
        context,
        validationReason,
      });

      return {
        status: canActivate
          ? 'verified_and_activated'
          : 'stored_for_validation',
        message: canActivate
          ? 'Verified administrator knowledge was activated.'
          : 'The unverified claim was quarantined for validation.',
        knowledgeEntryId: entryId,
      };
    });
  }

  private async storeRecommendationSignal(
    proposal: NormalizedProposal,
    context: AgentToolContext,
  ): Promise<AutonomousLearningResult> {
    return this.database.transaction(async (client) => {
      const sourceMessage = await this.sourceMessage(client, context);
      const duplicate = context.sourceMessageId
        ? (
            await client.query<InsertedIdRow>(
              `SELECT signal_id AS id
               FROM ai_learning_signals
               WHERE source_message_id = $1
                 AND signal_type = 'recommendation_feedback'
               LIMIT 1
               FOR UPDATE`,
              [context.sourceMessageId],
            )
          ).rows[0]
        : null;
      if (duplicate) {
        return {
          status: 'duplicate',
          message: 'That recommendation feedback was already recorded.',
          learningSignalId: Number(duplicate.id),
        };
      }

      const run = context.conversationId
        ? ((
            await client.query<RecommendationRunRow>(
              `SELECT recommendation_run_id AS "recommendationRunId",
                      candidate_option_ids AS "candidateOptionIds",
                      feature_snapshot AS "featureSnapshot",
                      requirement_snapshot AS "requirementSnapshot",
                      model_version AS "modelVersion"
               FROM ai_recommendation_runs
               WHERE conversation_id = $1
                 AND ($2::text IS NULL OR recommendation_run_id = $2)
               ORDER BY created_at DESC
               LIMIT 1`,
              [context.conversationId, proposal.recommendationRunId ?? null],
            )
          ).rows[0] ?? null)
        : null;

      const candidateIds = this.stringArray(run?.candidateOptionIds);
      const selectedOptionId = this.resolveOptionId(
        proposal.selectedOptionId,
        candidateIds,
      );
      const rejectedOptionId = this.resolveOptionId(
        proposal.rejectedOptionId,
        candidateIds,
      );
      const distinctRejectedOptionId =
        rejectedOptionId && rejectedOptionId !== selectedOptionId
          ? rejectedOptionId
          : null;
      const hasFeatureSnapshot = this.nonEmptyObject(run?.featureSnapshot);
      const hasRequirementSnapshot = this.nonEmptyObject(
        run?.requirementSnapshot,
      );
      const trainingReady = Boolean(
        sourceMessage &&
        run &&
        selectedOptionId &&
        distinctRejectedOptionId &&
        hasFeatureSnapshot &&
        hasRequirementSnapshot &&
        run.modelVersion,
      );
      const readinessReason = trainingReady
        ? 'Complete actual recommendation context and pairwise choice are present.'
        : 'Stored for analytics only: a complete actual recommendation run and selected/rejected pair were not available.';

      const inserted = await client.query<InsertedIdRow>(
        `INSERT INTO ai_learning_signals
           (user_id, conversation_id, source_message_id,
            recommendation_run_id, signal_type, selected_option_id,
            rejected_option_id, explanation, feature_snapshot,
            user_requirement_snapshot, model_version, training_ready,
            readiness_reason)
         VALUES
           ($1, $2, $3, $4, 'recommendation_feedback', $5,
            $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
         RETURNING signal_id AS id`,
        [
          context.userId,
          context.conversationId,
          context.sourceMessageId,
          run?.recommendationRunId ?? null,
          selectedOptionId,
          distinctRejectedOptionId,
          proposal.content,
          run ? JSON.stringify(run.featureSnapshot) : null,
          run ? JSON.stringify(run.requirementSnapshot) : null,
          run?.modelVersion ?? null,
          trainingReady,
          readinessReason,
        ],
      );
      return {
        status: 'stored_as_learning_signal',
        message:
          'Recommendation feedback was recorded as an analysis signal; no model was retrained.',
        learningSignalId: Number(inserted.rows[0].id),
      };
    });
  }

  private async sourceMessage(
    client: PoolClient,
    context: AgentToolContext,
  ): Promise<string | null> {
    if (!context.sourceMessageId || !context.conversationId) return null;
    const result = await client.query<SourceMessageRow>(
      `SELECT content
       FROM ai_messages
       WHERE message_id = $1
         AND conversation_id = $2
         AND role = 'user'
       LIMIT 1`,
      [context.sourceMessageId, context.conversationId],
    );
    return result.rows[0]?.content?.trim() || null;
  }

  private async recordVersion(
    client: PoolClient,
    input: {
      entryId: number;
      action: KnowledgeAction;
      previousSnapshot: unknown;
      newSnapshot: unknown;
      context: AgentToolContext;
      validationReason: string;
    },
  ) {
    const numberResult = await client.query<VersionNumberRow>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS "versionNumber"
       FROM ai_knowledge_versions
       WHERE entity_type = 'knowledge_entry'
         AND entity_id = $1`,
      [input.entryId],
    );
    const versionNumber = Number(numberResult.rows[0]?.versionNumber ?? 1);
    const versionName =
      `kb-${input.entryId}-v${versionNumber}-${Date.now()}`.slice(0, 50);
    await client.query(
      `INSERT INTO ai_knowledge_versions
         (version_name, entity_type, entity_id, field_name,
          old_value, new_value, change_reason, created_by,
          version_number, action_type, source_message_id,
          actor_role, validation_reason)
       VALUES
         ($1, 'knowledge_entry', $2, 'record',
          $3::jsonb, $4::jsonb, $5, $6,
          $7, $8, $9, $10, $11)`,
      [
        versionName,
        input.entryId,
        JSON.stringify(input.previousSnapshot),
        JSON.stringify(input.newSnapshot),
        input.validationReason,
        input.context.userId,
        versionNumber,
        input.action,
        input.context.sourceMessageId,
        input.context.role,
        input.validationReason,
      ],
    );
  }

  private async recordAudit(
    client: PoolClient,
    input: {
      entryId: number;
      entityKey: string;
      action: string;
      previousSnapshot: unknown;
      newSnapshot: unknown;
      context: AgentToolContext;
      validationReason: string;
    },
  ) {
    await client.query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, entity_key,
          old_value, new_value)
       VALUES ($1, $2, 'ai_knowledge_entry', $3, $4, $5::jsonb, $6::jsonb)`,
      [
        input.context.userId,
        input.action,
        input.entryId,
        input.entityKey,
        JSON.stringify(input.previousSnapshot),
        JSON.stringify({
          snapshot: input.newSnapshot,
          actorRole: input.context.role,
          sourceConversationId: input.context.conversationId,
          sourceMessageId: input.context.sourceMessageId,
          validationReason: input.validationReason,
        }),
      ],
    );
  }

  private knowledgeSelect() {
    return `SELECT knowledge_entry_id AS id, category, title, content,
                   knowledge_type AS "knowledgeType", scope,
                   owner_user_id AS "ownerUserId",
                   memory_key AS "memoryKey",
                   validation_status AS "validationStatus",
                   effective_from AS "effectiveFrom",
                   effective_to AS "effectiveTo",
                   is_active AS "isActive"
            FROM ai_knowledge_entries`;
  }

  private knowledgeSnapshot(row: KnowledgeRow) {
    return {
      category: row.category,
      title: row.title,
      content: row.content,
      knowledgeType: row.knowledgeType,
      scope: row.scope,
      ownerUserId: row.ownerUserId,
      memoryKey: row.memoryKey,
      validationStatus: row.validationStatus,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      isActive: row.isActive,
    };
  }

  private normalizeProposal(
    proposal: MemoryProposal,
  ): NormalizedProposal | null {
    if (!proposal || typeof proposal !== 'object') return null;
    const category = this.boundedText(proposal.category, MAX_CATEGORY_LENGTH);
    const rawTitle = this.boundedText(proposal.title, MAX_TITLE_LENGTH);
    const content = this.boundedText(proposal.content, MAX_CONTENT_LENGTH);
    const reason = this.boundedText(proposal.reason, MAX_REASON_LENGTH);
    if (!category || !rawTitle || !content || !reason) return null;
    const title = `${rawTitle.charAt(0).toLocaleUpperCase('vi')}${rawTitle.slice(1)}`;
    if (
      ![
        'user_preference',
        'business_rule',
        'faq',
        'information_correction',
        'recommendation_feedback',
      ].includes(proposal.memoryType)
    ) {
      return null;
    }
    if (!['user', 'global'].includes(proposal.requestedScope)) return null;
    if (
      proposal.memoryKey !== undefined &&
      !USER_MEMORY_KEY_SET.has(proposal.memoryKey)
    ) {
      return null;
    }
    return {
      ...proposal,
      category,
      title,
      content,
      reason,
      effectiveFrom: this.optionalText(proposal.effectiveFrom, 50),
      effectiveTo: this.optionalText(proposal.effectiveTo, 50),
      selectedOptionId: this.optionalText(proposal.selectedOptionId, 100),
      rejectedOptionId: this.optionalText(proposal.rejectedOptionId, 100),
      recommendationRunId: this.optionalText(
        proposal.recommendationRunId,
        100,
      ),
    };
  }

  private boundedText(value: unknown, maxLength: number) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(/\s+/g, ' ');
    const lowered = normalized.toLowerCase();
    if (
      !normalized ||
      normalized.length > maxLength ||
      lowered === 'undefined' ||
      lowered === 'null'
    ) {
      return null;
    }
    return normalized;
  }

  private optionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null) return undefined;
    return this.boundedText(value, maxLength) ?? undefined;
  }

  private isExplicitPreference(sourceMessage: string) {
    const folded = this.fold(sourceMessage);
    const asksToRemember =
      /\b(remember|please remember|ghi nho|nho giup|hay nho|luu lai|luu giup)\b/.test(
        folded,
      );
    if (asksToRemember) return true;

    // Accept normal colloquial Vietnamese self-reference ("tui", "t", "tao",
    // "em"...) but require an actual first-person preference assertion. This
    // avoids treating questions like "bạn biết tui thích gì không?" as new
    // memory just because they contain the word "thích".
    const firstPersonPreference =
      /^(?:i|we|toi|minh|tui|tao|t|to|em|anh|chi|chung toi|gia dinh toi|gia dinh minh)\b.{0,160}\b(?:prefer|preference|want|need|like|priority|uu tien|thich|muon|can|doi y|thay doi|cap nhat|sua lai|khong con can|change|update)\b/.test(
        folded,
      );
    const preferenceQuestion =
      /\b(?:thich gi|uu tien gi|muon gi|so thich gi|biet .* thich gi)\b/.test(
        folded,
      );
    return firstPersonPreference && !preferenceQuestion;
  }

  private isDurableConsultationPreference(sourceMessage: string) {
    const folded = this.fold(sourceMessage);
    const topic =
      /\b(?:phong thuy|feng shui|fengshui|bazi|bat tu|am trach|van hoa|tam linh)\b/.test(
        folded,
      );
    if (!topic) return false;
    const asksToRemember =
      /\b(?:remember|please remember|ghi nho|nho giup|hay nho|luu lai|luu giup)\b/.test(
        folded,
      );
    const futureScope =
      /\b(?:tu gio|sau nay|ve sau|lan sau|nhung lan sau|cac lan sau|moi lan|cac lan tu van|nhung lan tu van|trong tuong lai)\b/.test(
        folded,
      );
    const explicitStylePreference =
      /^(?:i|we|toi|minh|tui|tao|t|em|anh|chi)\b.{0,120}\b(?:prefer|like|thich|uu tien)\b.{0,120}\b(?:consult|conversation|explain|topic|tu van|trao doi|giai thich|chu de|goc nhin)\b/.test(
        folded,
      );
    return asksToRemember || futureScope || explicitStylePreference;
  }

  private isSafePreference(content: string) {
    const folded = this.fold(content);
    return !/\b(psycholog|anxiety|depress|grief|religio|medical|diagnos|health condition|tam ly|lo au|tram cam|ton giao|dao phat|dao chua|benh|chan doan)\b/.test(
      folded,
    );
  }

  private inferMemoryKey(proposal: NormalizedProposal): UserMemoryKey {
    const text = this.fold(
      `${proposal.category} ${proposal.title} ${proposal.content}`,
    );
    if (
      /\b(phong thuy|feng shui|fengshui|bazi|bat tu|am trach|van hoa|cultural|consultation topic|chu de tu van|chu de tro chuyen)\b/.test(
        text,
      )
    ) {
      return 'consultation_topic_preference';
    }
    if (
      /\b(quiet|yen tinh|entrance|gate|gan cong|vi tri|location)\b/.test(text)
    ) {
      return 'preferred_plot_location';
    }
    if (/\b(min|minimum|at least|toi thieu|it nhat)\b/.test(text)) {
      return 'minimum_budget';
    }
    if (
      /\b(max|maximum|under|toi da|khong qua|budget|ngan sach)\b/.test(text)
    ) {
      return 'maximum_budget';
    }
    if (/\b(adjacent|side by side|lien ke|lien nhau|canh nhau)\b/.test(text)) {
      return 'adjacent_plot_count';
    }
    if (/\b(zone|khu [a-z]|khu vuc)\b/.test(text)) return 'preferred_zone';
    if (/\b(direction|huong)\b/.test(text)) return 'preferred_direction';
    if (/\b(access|accessible|wheelchair|de di|di lai)\b/.test(text)) {
      return 'accessibility_priority';
    }
    if (
      /\b(plot type|single|double|family|lo don|lo doi|lo gia dinh)\b/.test(
        text,
      )
    ) {
      return 'preferred_plot_type';
    }
    if (/\b(short|brief|detail|concise|ngan gon|chi tiet)\b/.test(text)) {
      return 'response_detail_preference';
    }
    if (
      /\b(service|clean|flower|incense|dich vu|don dep|hoa|thap huong)\b/.test(
        text,
      )
    ) {
      return 'service_interest';
    }
    return 'preferred_plot_location';
  }

  private globalKnowledgeKey(proposal: NormalizedProposal) {
    return `${proposal.memoryType}:${this.slug(proposal.category)}`.slice(
      0,
      100,
    );
  }

  private globalValidationReason(
    memoryType: MemoryType,
    trustedAdmin: boolean,
  ) {
    if (memoryType === 'information_correction') {
      return 'Natural-language corrections require comparison with authoritative internal records.';
    }
    if (!trustedAdmin) {
      return 'Customer-provided business knowledge is unverified and cannot become active.';
    }
    return 'Authenticated administrator source and backend schema validation succeeded.';
  }

  private parseDate(value?: string): Date | null | undefined {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private resolveOptionId(value: string | undefined, candidates: string[]) {
    if (!value || !candidates.length) return null;
    const normalized = value.trim().toUpperCase();
    const direct = candidates.find(
      (candidate) => candidate.toUpperCase() === normalized,
    );
    if (direct) return direct;
    const letter = normalized.match(
      /^(?:OPTION|PHUONG AN|LUA CHON)?\s*([A-Z])$/,
    )?.[1];
    if (letter) return candidates[letter.charCodeAt(0) - 65] ?? null;
    const number = normalized.match(
      /^(?:OPT-|OPTION\s*|PHUONG AN\s*|LUA CHON\s*)?(\d+)$/,
    )?.[1];
    if (number) return candidates[Number(number) - 1] ?? null;
    return null;
  }

  private stringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
  }

  private nonEmptyObject(value: unknown) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0,
    );
  }

  private normalizeForHash(value: string) {
    return this.fold(value).replace(/\s+/g, ' ').trim();
  }

  private hash(parts: string[]) {
    return createHash('sha256').update(parts.join('|')).digest('hex');
  }

  private fold(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  private slug(value: string) {
    return (
      this.fold(value)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 70) || `knowledge_${randomUUID().slice(0, 8)}`
    );
  }

  private sourceReference(sourceMessageId: number | string | null) {
    return sourceMessageId ? `ai_message:${sourceMessageId}` : null;
  }

  private result(
    context: AgentToolContext,
    action: MemoryType | undefined,
    result: AutonomousLearningResult,
  ) {
    this.logger.log(
      JSON.stringify({
        conversationId: context.conversationId ?? null,
        sourceMessageId: context.sourceMessageId ?? null,
        action: action ?? 'invalid_proposal',
        resultStatus: result.status,
      }),
    );
    return result;
  }
}
