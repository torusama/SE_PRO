import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { createHash } from 'crypto';

export interface KnowledgeProposal {
  category: string;
  title: string;
  content: string;
  knowledgeType: string;
  requestedScope: string;
  sourceMessageId?: string;
  reason: string;
}

export interface ProposalContext {
  userId?: number | null;
  role?: string | null;
  sessionId?: string | null;
  messageId?: number | null;
}

@Injectable()
export class AutonomousLearningService {
  private readonly logger = new Logger(AutonomousLearningService.name);

  constructor(private readonly database: DatabaseService) {}

  async processProposal(proposal: KnowledgeProposal, context: ProposalContext) {
    const type = proposal.knowledgeType;
    const isUserScope =
      type === 'implicit_profile' || type === 'explicit_preference';
    const scope = isUserScope ? 'user' : 'global';
    const ownerUserId = isUserScope ? context.userId : null;

    let status = 'proposed';
    let is_active = false;

    if (isUserScope) {
      status = 'active';
      is_active = true;
    } else if (type === 'recommendation_feedback') {
      status = 'training_signal';
      is_active = false;
    } else {
      if (context.role === 'admin' || context.role === 'superadmin') {
        status = 'active';
        is_active = true;
      } else {
        status = 'quarantined';
        is_active = false;
      }
    }

    const contentString = `${proposal.title}:${proposal.content}`;
    const contentHash = createHash('sha256')
      .update(contentString)
      .digest('hex');

    const knowledgeKey = `auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const result = await this.database.queryOne<{ id: number }>(
        `INSERT INTO ai_knowledge_entries 
         (knowledge_key, category, title, content, source_type, scope, owner_user_id, 
          validation_status, source_message_id, source_session_id, source_role, 
          content_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (content_hash) DO NOTHING
         RETURNING knowledge_entry_id AS id`,
        [
          knowledgeKey,
          proposal.category,
          proposal.title,
          proposal.content,
          type,
          scope,
          ownerUserId,
          status,
          context.messageId || proposal.sourceMessageId || null,
          context.sessionId || null,
          context.role || 'customer',
          contentHash,
          is_active,
        ],
      );

      if (!result) {
        return { status: 'duplicate', message: 'Knowledge already exists.' };
      }

      if (isUserScope) {
        return {
          status: 'saved_user_memory',
          message: 'User memory saved successfully.',
        };
      } else if (status === 'active') {
        return {
          status: 'verified_and_activated',
          message: 'Global knowledge verified and activated.',
        };
      } else if (status === 'training_signal') {
        return {
          status: 'stored_for_training',
          message: 'Recommendation feedback stored for model training.',
        };
      } else {
        return {
          status: 'stored_for_validation',
          message: 'Proposal stored and quarantined for validation.',
        };
      }
    } catch (e) {
      this.logger.error('Failed to process knowledge proposal', e);
      return {
        status: 'error',
        message: 'Failed to store knowledge proposal.',
      };
    }
  }
}
