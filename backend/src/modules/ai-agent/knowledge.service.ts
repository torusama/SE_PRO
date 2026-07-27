import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly database: DatabaseService) {}

  async getPurchaseProcess() {
    const row = await this.database.queryOne<{
      title: string;
      content: string;
      version: string;
    }>(
      `SELECT k.title, k.content,
              COALESCE(
                (SELECT version_name
                 FROM ai_knowledge_versions
                 WHERE entity_type = 'knowledge_entry'
                   AND entity_id = k.knowledge_entry_id
                 ORDER BY created_at DESC LIMIT 1),
                'kb-v1'
              ) AS version
       FROM ai_knowledge_entries k
       WHERE k.knowledge_key = 'purchase-process-v1'
         AND k.is_active = TRUE`,
    );
    return (
      row ?? {
        title: 'Quy trình tạo yêu cầu mua lô',
        content:
          'Chọn phương án, tạo yêu cầu nháp, kiểm tra lại và chủ động gửi yêu cầu để quản trị viên xác minh. Yêu cầu nháp chưa phải giao dịch hoàn tất.',
        version: 'kb-v1',
      }
    );
  }

  async getCurrentVersion() {
    const row = await this.database.queryOne<{ version: string }>(
      `SELECT COALESCE(
         (SELECT version_name FROM ai_knowledge_versions
          ORDER BY created_at DESC LIMIT 1),
         'kb-v1'
       ) AS version`,
    );
    return row?.version ?? 'kb-v1';
  }

  async getPromptContext() {
    try {
      const rows = await this.database.query<{
        title: string;
        content: string;
      }>(
        `SELECT title, content
         FROM ai_knowledge_entries
         WHERE is_active = TRUE
         ORDER BY updated_at DESC
         LIMIT 8`,
      );
      return rows.map((row) => `- ${row.title}: ${row.content}`).join('\n');
    } catch {
      return '';
    }
  }

  async applyApprovedCorrection(feedbackId: number, adminId: number) {
    return this.database.transaction(async (client) => {
      const feedbackResult = await client.query<{
        feedback_id: number;
        validation_status: string;
        original_content: string | null;
        corrected_content: string | null;
        reason: string | null;
      }>(
        `SELECT feedback_id, validation_status, original_content,
                corrected_content, reason
         FROM ai_feedback
         WHERE feedback_id = $1
         FOR UPDATE`,
        [feedbackId],
      );
      const feedback = feedbackResult.rows[0];
      if (!feedback) throw new NotFoundException('Feedback not found');
      if (feedback.validation_status !== 'approved') {
        throw new BadRequestException('Only approved feedback can be applied');
      }
      if (!feedback.corrected_content?.trim()) {
        throw new BadRequestException(
          'Approved correction has no corrected content',
        );
      }

      const knowledgeKey = `verified-correction-${feedbackId}`;
      const oldResult = await client.query<{
        id: number;
        content: string;
      }>(
        `SELECT knowledge_entry_id AS id, content
         FROM ai_knowledge_entries
         WHERE knowledge_key = $1
         FOR UPDATE`,
        [knowledgeKey],
      );
      const oldEntry = oldResult.rows[0] ?? null;
      const entryResult = await client.query<{ id: number }>(
        `INSERT INTO ai_knowledge_entries
           (knowledge_key, category, title, content, source_type,
            source_reference, is_active)
         VALUES ($1, 'verified_correction', $2, $3, 'admin_feedback', $4, TRUE)
         ON CONFLICT (knowledge_key) DO UPDATE
           SET title = EXCLUDED.title,
               content = EXCLUDED.content,
               source_reference = EXCLUDED.source_reference,
               is_active = TRUE,
               updated_at = NOW()
         RETURNING knowledge_entry_id AS id`,
        [
          knowledgeKey,
          (feedback.original_content || `Correction ${feedbackId}`).slice(
            0,
            200,
          ),
          feedback.corrected_content,
          `ai_feedback:${feedbackId}`,
        ],
      );
      const entryId = entryResult.rows[0].id;
      const versionName = `kb-${Date.now()}-${feedbackId}`;
      await client.query(
        `INSERT INTO ai_knowledge_versions
           (version_name, entity_type, entity_id, field_name,
            old_value, new_value, feedback_id, change_reason, created_by)
         VALUES ($1, 'knowledge_entry', $2, 'content',
                 $3::jsonb, $4::jsonb, $5, $6, $7)`,
        [
          versionName,
          entryId,
          JSON.stringify(oldEntry ? { content: oldEntry.content } : null),
          JSON.stringify({ content: feedback.corrected_content }),
          feedbackId,
          feedback.reason || 'Approved AI knowledge correction',
          adminId,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs
           (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, 'ai_knowledge_correction_applied',
                 'ai_knowledge_entry', $2, $3::jsonb, $4::jsonb)`,
        [
          adminId,
          entryId,
          JSON.stringify(oldEntry),
          JSON.stringify({
            content: feedback.corrected_content,
            feedbackId,
            versionName,
          }),
        ],
      );
      await client.query(
        `UPDATE ai_feedback
         SET validation_status = 'applied', applied_at = NOW(),
             updated_at = NOW()
         WHERE feedback_id = $1`,
        [feedbackId],
      );
      return {
        feedbackId,
        status: 'applied',
        knowledgeEntryId: entryId,
        versionName,
      };
    });
  }
}
