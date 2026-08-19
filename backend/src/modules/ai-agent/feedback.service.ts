import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ReviewFeedbackDto } from './dto/review-feedback.dto';
import { KnowledgeService } from './knowledge.service';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly database: DatabaseService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async create(dto: CreateFeedbackDto, userId?: number | null) {
    const conversation = await this.database.queryOne<{ id: number }>(
      `SELECT conversation_id AS id
       FROM ai_conversations
       WHERE session_id = $1
         AND (
           ($2::int IS NULL AND user_id IS NULL)
           OR user_id = $2
         )`,
      [dto.sessionId, userId ?? null],
    );
    if (!conversation) {
      throw new NotFoundException('AI conversation not found');
    }
    if (dto.messageId) {
      const message = await this.database.queryOne<{ id: number }>(
        `SELECT message_id AS id
         FROM ai_messages
         WHERE message_id = $1 AND conversation_id = $2`,
        [dto.messageId, conversation.id],
      );
      if (!message) {
        throw new BadRequestException(
          'Message does not belong to this conversation',
        );
      }
    }
    const row = await this.database.queryOne<{
      feedbackId: number;
      status: string;
      createdAt: Date;
    }>(
      `INSERT INTO ai_feedback
         (conversation_id, message_id, user_id, feedback_type, rating,
          original_content, corrected_content, reason, evidence_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING feedback_id AS "feedbackId",
                 validation_status AS status,
                 created_at AS "createdAt"`,
      [
        conversation.id,
        dto.messageId ?? null,
        userId ?? null,
        dto.feedbackType,
        dto.rating ?? null,
        dto.originalContent ?? null,
        dto.correctedContent ?? null,
        dto.reason ?? null,
        dto.evidenceUrl ?? null,
      ],
    );
    return row;
  }

  list(status?: string) {
    return this.database.query(
      `SELECT f.feedback_id AS "feedbackId", f.feedback_type AS "feedbackType",
              f.rating, f.original_content AS "originalContent",
              f.corrected_content AS "correctedContent", f.reason,
              f.evidence_url AS "evidenceUrl",
              f.validation_status AS status, f.review_note AS "reviewNote",
              f.created_at AS "createdAt", f.validated_at AS "validatedAt",
              c.session_id AS "sessionId", u.full_name AS "userName"
       FROM ai_feedback f
       LEFT JOIN ai_conversations c ON c.conversation_id = f.conversation_id
       LEFT JOIN users u ON u.user_id = f.user_id
       WHERE ($1::text IS NULL OR f.validation_status = $1)
       ORDER BY f.created_at DESC
       LIMIT 200`,
      [status || null],
    );
  }

  async get(id: number) {
    const row = await this.database.queryOne(
      `SELECT f.*, c.session_id, m.content AS assistant_message
       FROM ai_feedback f
       LEFT JOIN ai_conversations c ON c.conversation_id = f.conversation_id
       LEFT JOIN ai_messages m ON m.message_id = f.message_id
       WHERE f.feedback_id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Feedback not found');
    return row;
  }

  async review(
    id: number,
    adminId: number,
    action: 'approve' | 'reject',
    dto: ReviewFeedbackDto,
  ) {
    const reviewed = await this.database.transaction(async (client) => {
      const current = await client.query<{
        feedback_type: string;
        validation_status: string;
        corrected_content: string | null;
      }>(
        `SELECT feedback_type, validation_status, corrected_content
         FROM ai_feedback
         WHERE feedback_id = $1
         FOR UPDATE`,
        [id],
      );
      const feedback = current.rows[0];
      if (!feedback) throw new NotFoundException('Feedback not found');
      if (!['pending', 'validating'].includes(feedback.validation_status)) {
        throw new BadRequestException('Feedback was already reviewed');
      }
      const status = action === 'approve' ? 'approved' : 'rejected';
      const result = await client.query<{
        feedbackId: number;
        status: string;
      }>(
        `UPDATE ai_feedback
         SET validation_status = $2, reviewed_by = $3,
             review_note = $4, validated_at = NOW(), updated_at = NOW()
         WHERE feedback_id = $1
         RETURNING feedback_id AS "feedbackId",
                   validation_status AS status`,
        [id, status, adminId, dto.reviewNote ?? null],
      );

      return {
        ...result.rows[0],
        feedbackType: feedback.feedback_type,
        hasCorrection: !!feedback.corrected_content,
      };
    });

    if (
      action === 'approve' &&
      dto.applyCorrection &&
      reviewed.hasCorrection &&
      reviewed.feedbackType !== 'price_proposal'
    ) {
      try {
        return await this.knowledge.applyApprovedCorrection(id, adminId);
      } catch (error) {
        // applyApprovedCorrection is transactional, so a failure means no
        // knowledge entry was committed. Restore the feedback to a retryable
        // state instead of leaving it permanently `approved` while the
        // correction was never applied.
        await this.database.query(
          `UPDATE ai_feedback
           SET validation_status = 'pending', reviewed_by = NULL,
               review_note = NULL, validated_at = NULL, updated_at = NOW()
           WHERE feedback_id = $1
             AND validation_status = 'approved'
             AND applied_at IS NULL`,
          [id],
        );
        throw error;
      }
    }
    return reviewed;
  }
}
