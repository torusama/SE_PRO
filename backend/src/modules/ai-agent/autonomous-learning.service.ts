import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { createHash } from 'crypto';

export interface KnowledgeProposal {
  category: string;
  title: string;
  content: string;
  knowledgeType:
    | 'user_preference'
    | 'business_rule'
    | 'faq'
    | 'information_correction'
    | 'recommendation_feedback';
  requestedScope: 'user' | 'global';
  reason: string;
}

export interface ProposalContext {
  userId?: number | null;
  role?: string | null;
  conversationId?: number | string | null;
  sessionId?: string | null;
  messageId?: number | string | null;
}

@Injectable()
export class AutonomousLearningService {
  private readonly logger = new Logger(AutonomousLearningService.name);

  constructor(private readonly database: DatabaseService) {}

  async processProposal(proposal: KnowledgeProposal, context: ProposalContext) {
    const {
      knowledgeType,
      requestedScope,
      category,
      title,
      content,
      reason,
    } = proposal;

    if (knowledgeType === 'recommendation_feedback') {
      try {
        await this.database.query(
          `INSERT INTO ai_learning_signals 
           (conversation_id, message_id, user_id, signal_type, category, content, context_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            context.conversationId || null,
            context.messageId || null,
            context.userId || null,
            'recommendation_feedback',
            category,
            content,
            JSON.stringify({ reason }),
          ],
        );
        return {
          status: 'stored_for_training',
          message: 'Recommendation feedback stored for model training.',
        };
      } catch (e) {
        this.logger.error('Failed to store learning signal', e);
        return {
          status: 'error',
          message: 'Failed to store learning signal.',
        };
      }
    }

    const isUserScope = requestedScope === 'user';
    if (isUserScope && !context.userId) {
      return {
        status: 'login_required',
        message: 'Persistent user preferences require the user to be logged in.',
      };
    }

    let validationStatus = 'proposed';
    let isActive = false;

    if (isUserScope) {
      validationStatus = 'active';
      isActive = true;
    } else {
      if (context.role === 'admin' || context.role === 'superadmin') {
        validationStatus = 'active';
        isActive = true;
      } else {
        validationStatus = 'quarantined';
        isActive = false;
      }
    }

    const contentHash = createHash('sha256').update(`${title}:${content}`).digest('hex');
    const scopeStr = isUserScope ? 'user' : 'global';
    const ownerId = isUserScope ? context.userId : null;
    const memoryKey = isUserScope ? category : null; 

    return this.database.transaction(async (dbClient) => {
      try {
        if (isUserScope) {
          const existing = await dbClient.query(
            `SELECT knowledge_entry_id FROM ai_knowledge_entries 
             WHERE owner_user_id = $1 AND category = $2 AND is_active = TRUE`,
            [ownerId, category]
          );
          
          let supersedesEntryId = null;
          if (existing.rows.length > 0) {
            supersedesEntryId = existing.rows[0].knowledge_entry_id;
            await dbClient.query(
              `UPDATE ai_knowledge_entries 
               SET is_active = FALSE, validation_status = 'superseded', effective_to = NOW()
               WHERE knowledge_entry_id = $1`,
              [supersedesEntryId]
            );
          }

          const insertResult = await dbClient.query(
            `INSERT INTO ai_knowledge_entries 
             (category, title, content, source_type, scope, owner_user_id, memory_key,
              validation_status, source_message_id, source_conversation_id, source_role, 
              content_hash, supersedes_entry_id, effective_from, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), $14)
             ON CONFLICT (owner_user_id, COALESCE(memory_key, category), content_hash) 
             WHERE scope = 'user' AND is_active = TRUE AND validation_status IN ('proposed', 'active') DO NOTHING
             RETURNING knowledge_entry_id`,
            [
              category, title, content, knowledgeType, scopeStr, ownerId, memoryKey,
              validationStatus, context.messageId || null, context.conversationId || null,
              context.role || 'customer', contentHash, supersedesEntryId, isActive
            ]
          );

          if (insertResult.rows.length === 0) {
            return { status: 'duplicate', message: 'Knowledge already exists.' };
          }
          return { status: 'saved_user_memory', message: 'User memory saved successfully.' };
        } else {
          const insertResult = await dbClient.query(
            `INSERT INTO ai_knowledge_entries 
             (category, title, content, source_type, scope,
              validation_status, source_message_id, source_conversation_id, source_role, 
              content_hash, effective_from, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
             ON CONFLICT (category, content_hash) 
             WHERE scope = 'global' AND is_active = TRUE AND validation_status IN ('proposed', 'active') DO NOTHING
             RETURNING knowledge_entry_id`,
            [
              category, title, content, knowledgeType, scopeStr,
              validationStatus, context.messageId || null, context.conversationId || null,
              context.role || 'customer', contentHash, isActive
            ]
          );

          if (insertResult.rows.length === 0) {
            return { status: 'duplicate', message: 'Knowledge already exists.' };
          }

          if (isActive) {
            return { status: 'verified_and_activated', message: 'Global knowledge verified and activated.' };
          } else {
            return { status: 'stored_for_validation', message: 'Proposal stored and quarantined for validation.' };
          }
        }
      } catch (e) {
        this.logger.error('Failed to process knowledge proposal', e);
        return { status: 'error', message: 'Failed to store knowledge proposal.' };
      }
    });
  }
}
