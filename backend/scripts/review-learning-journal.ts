import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { AgentLearningJournalService } from '../src/modules/ai-agent/agent-learning-journal.service';
import { KnowledgeService } from '../src/modules/ai-agent/knowledge.service';
import { MultiProviderLlmService } from '../src/modules/ai-agent/multi-provider-llm.service';
import { isRuntimeOperationalClaim } from '../src/modules/ai-agent/knowledge-safety.util';

type PendingLesson = {
  learningJournalId: number;
  lessonKey: string;
  title: string;
  summary: string;
  preventionRule: string;
  category: string;
};

type ReviewDecision = {
  decision: 'auto_approve' | 'journal_only';
  evaluationReason: string;
};

type ReviewResult = {
  id: number;
  title: string;
  category: string;
  decision: ReviewDecision['decision'] | 'error';
  applied: boolean;
  reason: string;
  knowledgeEntryId?: number;
  elapsedMs: number;
};

const EVALUATOR = 'openai/gpt-oss-20b@nvidia';
const AUTONOMOUS_CATEGORIES = new Set([
  'intent',
  'context',
  'tone',
  'conversation',
]);

function parseDecision(raw: string): ReviewDecision | undefined {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<ReviewDecision>;
    if (
      parsed.decision !== 'auto_approve' &&
      parsed.decision !== 'journal_only'
    ) {
      return;
    }
    const reason =
      typeof parsed.evaluationReason === 'string'
        ? parsed.evaluationReason.replace(/\s+/g, ' ').trim().slice(0, 1000)
        : '';
    if (!reason) return;
    return { decision: parsed.decision, evaluationReason: reason };
  } catch {
    return;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const rawLimit = Number(process.argv.find((value) => /^\d+$/.test(value)) ?? 8);
  const limit = Math.max(1, Math.min(Math.floor(rawLimit), 20));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    // Resolve this once as a startup assertion: the same service owns the live
    // reflection path that creates the journal entries being reviewed here.
    app.get(AgentLearningJournalService);
    const database = app.get(DatabaseService);
    const llm = app.get(MultiProviderLlmService);
    const knowledge = app.get(KnowledgeService);

    const lessons = await database.query<PendingLesson>(
      `WITH pending AS (
         SELECT learning_journal_id AS "learningJournalId",
                lesson_key AS "lessonKey",
                title,
                summary,
                prevention_rule AS "preventionRule",
                category,
                ROW_NUMBER() OVER (
                  PARTITION BY category
                  ORDER BY last_observed_at DESC, learning_journal_id DESC
                ) AS category_rank
         FROM ai_learning_journal_entries
         WHERE status = 'active'
           AND review_status = 'pending'
           AND knowledge_entry_id IS NULL
           AND evaluated_at IS NULL
       )
       SELECT "learningJournalId", "lessonKey", title, summary,
              "preventionRule", category
       FROM pending
       ORDER BY category_rank ASC, "learningJournalId" DESC
       LIMIT $1`,
      [limit],
    );

    const reviewOne = async (lesson: PendingLesson): Promise<ReviewResult> => {
      const startedAt = Date.now();
      try {
        const content = `${lesson.title}\n${lesson.summary}\n${lesson.preventionRule}`;
        const operational = isRuntimeOperationalClaim(content);
        const response = await llm.chat(
          [
            {
              role: 'system',
              content: `Bạn là bộ kiểm duyệt bài học tự rút ra của trợ lý Vĩnh Phúc Viên.
Hãy quyết định bài học đã được khử dữ liệu cá nhân dưới đây có an toàn để AI tự áp dụng cho các cuộc trò chuyện sau hay vẫn phải chờ quản trị viên.
Chỉ auto_approve nếu đây là nguyên tắc giao tiếp, ứng xử, giữ ngữ cảnh hoặc nhận diện ý định tổng quát, đúng và không tạo ra sự thật nghiệp vụ mới.
Phải chọn journal_only nếu nội dung liên quan hoặc có thể làm thay đổi giá, chính sách, thanh toán, quyền hạn, dữ liệu lô/dịch vụ, trạng thái giao dịch, thời hạn hay workflow nghiệp vụ; hoặc nếu nội dung mơ hồ/chưa đủ căn cứ.
Không sửa lại bài học và không suy đoán thêm thông tin. Trả duy nhất JSON:
{"decision":"auto_approve|journal_only","evaluationReason":"lý do ngắn gọn bằng tiếng Việt"}`,
            },
            {
              role: 'user',
              content: `Nhóm: ${lesson.category}\nTiêu đề: ${lesson.title}\nAI đã học: ${lesson.summary}\nQuy tắc tránh lặp lại: ${lesson.preventionRule}`,
            },
          ],
          [],
          'none',
          {
            temperature: 0.1,
            maxTokens: 240,
            enableThinking: false,
            reasoningEffort: 'low',
            routingKey: `learning-journal-backfill:${lesson.learningJournalId}`,
            timeoutMs: 8_000,
            totalTimeoutMs: 10_000,
            preferredProviderId: 'openai-primary',
            strictPreferredProvider: true,
          },
        );
        const raw = response.choices?.[0]?.message?.content?.trim() ?? '';
        const parsed = parseDecision(raw);
        if (!parsed) throw new Error('Model did not return valid review JSON');

        const canAutoApprove =
          parsed.decision === 'auto_approve' &&
          AUTONOMOUS_CATEGORIES.has(lesson.category) &&
          !operational;
        const decision: ReviewDecision['decision'] = canAutoApprove
          ? 'auto_approve'
          : 'journal_only';
        const reason =
          parsed.decision === 'auto_approve' && !canAutoApprove
            ? `${parsed.evaluationReason} Lớp an toàn hệ thống giữ bài này chờ quản trị viên.`
            : parsed.evaluationReason;

        let knowledgeEntryId: number | undefined;
        if (apply && canAutoApprove) {
          const activated = await knowledge.activateLearningJournalInstruction({
            learningJournalId: lesson.learningJournalId,
            lessonKey: lesson.lessonKey,
            title: lesson.title,
            summary: lesson.summary,
            preventionRule: lesson.preventionRule,
            category: lesson.category,
            evaluatorModel: EVALUATOR,
            evaluationReason: reason,
          });
          knowledgeEntryId = activated.knowledgeEntryId;
          await database.query(
            `UPDATE ai_learning_journal_entries
             SET review_status = 'auto_approved',
                 knowledge_entry_id = $2,
                 evaluator_model = $3,
                 evaluation_reason = $4,
                 evaluated_at = NOW(),
                 updated_at = NOW()
             WHERE learning_journal_id = $1
               AND status = 'active'
               AND review_status = 'pending'`,
            [lesson.learningJournalId, knowledgeEntryId, EVALUATOR, reason],
          );
        } else if (apply) {
          await database.query(
            `UPDATE ai_learning_journal_entries
             SET evaluator_model = $2,
                 evaluation_reason = $3,
                 evaluated_at = NOW(),
                 updated_at = NOW()
             WHERE learning_journal_id = $1
               AND status = 'active'
               AND review_status = 'pending'`,
            [lesson.learningJournalId, EVALUATOR, reason],
          );
        }

        return {
          id: lesson.learningJournalId,
          title: lesson.title,
          category: lesson.category,
          decision,
          applied: apply,
          reason,
          ...(knowledgeEntryId ? { knowledgeEntryId } : {}),
          elapsedMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          id: lesson.learningJournalId,
          title: lesson.title,
          category: lesson.category,
          decision: 'error',
          applied: false,
          reason: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - startedAt,
        };
      }
    };

    const results: ReviewResult[] = [];
    for (let index = 0; index < lessons.length; index += 3) {
      results.push(...(await Promise.all(lessons.slice(index, index + 3).map(reviewOne))));
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          evaluator: EVALUATOR,
          requested: limit,
          reviewed: results.length,
          approved: results.filter((item) => item.decision === 'auto_approve').length,
          held: results.filter((item) => item.decision === 'journal_only').length,
          errors: results.filter((item) => item.decision === 'error').length,
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
