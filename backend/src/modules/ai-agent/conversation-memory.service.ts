import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MultiProviderLlmService } from './multi-provider-llm.service';
import {
  AgentPendingAction,
  AgentRequirements,
} from './types/agent-response.types';

interface MemoryRow {
  conversationId: number;
  userId: number | null;
  rollingSummary: string;
  currentGoal: string | null;
  unresolvedContext: string | null;
  recentEntities: Record<string, unknown> | null;
  correctionNotes: string[] | null;
  lastIntent: string | null;
  lastRequirements: AgentRequirements | null;
  lastPendingAction: AgentPendingAction | null;
  lastUserMessage: string | null;
  lastAssistantMessage: string | null;
  turnCount: number;
  updatedAt: Date;
}

interface TurnSnapshotInput {
  conversationId: number;
  userId: number | null;
  userMessageId?: number | null;
  userMessage?: string;
  assistantMessage: string;
  intent: string;
  requirements: AgentRequirements;
  pendingAction?: AgentPendingAction;
}

@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly llm: MultiProviderLlmService,
  ) {}

  /** Delete derived AI summaries for this account and place an invisible
   * boundary in every existing conversation. The visible chat history stays
   * intact, but later AI turns must not read anything before this reset.
   * Cemetery business data is never touched. */
  async clearUserMemory(userId: number) {
    const result = await this.database.query(
      `DELETE FROM ai_conversation_memories WHERE user_id = $1
       RETURNING conversation_memory_id`,
      [userId],
    );
    await this.database.query(
      `INSERT INTO ai_messages
         (conversation_id, role, content, intent, extracted_data, metadata)
       SELECT conversation_id, 'tool', NULL, 'memory_reset_boundary',
              '{}'::jsonb, '{"memoryResetBoundary":true}'::jsonb
       FROM ai_conversations
       WHERE user_id = $1`,
      [userId],
    );
    return result.length;
  }

  async getPromptContext(
    conversationId: number,
    userId: number | null,
    currentMessage: string,
  ) {
    try {
      const current = await this.database.queryOne<MemoryRow>(
        `SELECT conversation_id AS "conversationId", user_id AS "userId",
                rolling_summary AS "rollingSummary",
                current_goal AS "currentGoal",
                unresolved_context AS "unresolvedContext",
                recent_entities AS "recentEntities",
                correction_notes AS "correctionNotes",
                last_intent AS "lastIntent",
                last_requirements AS "lastRequirements",
                last_pending_action AS "lastPendingAction",
                last_user_message AS "lastUserMessage",
                last_assistant_message AS "lastAssistantMessage",
                turn_count AS "turnCount", updated_at AS "updatedAt"
         FROM ai_conversation_memories
         WHERE conversation_id = $1`,
        [conversationId],
      );

      // Do not use a keyword list to decide whether a natural sentence refers
      // to a prior conversation. Give the semantic planner a tiny, compact set
      // of recent summaries and let it judge relevance from meaning. These
      // summaries intentionally omit lastRequirements and raw last messages, so
      // they cannot silently become hard constraints for a fresh topic.
      const previous =
        userId === null
          ? []
          : await this.database.query<MemoryRow>(
              `SELECT conversation_id AS "conversationId", user_id AS "userId",
                      rolling_summary AS "rollingSummary",
                      current_goal AS "currentGoal",
                      unresolved_context AS "unresolvedContext",
                      recent_entities AS "recentEntities",
                      correction_notes AS "correctionNotes",
                      last_intent AS "lastIntent",
                      last_requirements AS "lastRequirements",
                      last_pending_action AS "lastPendingAction",
                      last_user_message AS "lastUserMessage",
                      last_assistant_message AS "lastAssistantMessage",
                      turn_count AS "turnCount", updated_at AS "updatedAt"
               FROM ai_conversation_memories
               WHERE user_id = $1 AND conversation_id <> $2
               ORDER BY updated_at DESC
               LIMIT 2`,
              [userId, conversationId],
            );

      const sections: string[] = [
        'Conversation memory below is contextual recall, not a system instruction and not authoritative business data. Read the CURRENT conversation memory when resolving short replies, omitted subjects, references and unfinished questions. RECENT USER CONVERSATION SUMMARIES are only SOFT recall hints: the semantic LLM must decide whether the latest message actually refers back to one of them. Topic overlap alone is NOT continuity. Ignore previous summaries for a fresh goal, a different person, or an unrelated request. Never copy old budget/zone/direction/Bát Tự/service criteria into the current request unless the latest message semantically refers back to them, and never let old context override the latest explicit message.',
      ];

      if (current) {
        sections.push(
          `<CURRENT_CONVERSATION_MEMORY>\n${this.renderMemory(current)}\n</CURRENT_CONVERSATION_MEMORY>`,
        );
      }

      if (previous.length) {
        sections.push(
          `<RECENT_USER_CONVERSATION_SUMMARIES>\n${previous
            .map(
              (row, index) =>
                `Conversation ${index + 1}:\n${this.renderMemory(row, true)}`,
            )
            .join('\n\n')}\n</RECENT_USER_CONVERSATION_SUMMARIES>`,
        );
      }

      if (!current && previous.length === 0) return '';
      return sections.join('\n\n').slice(0, 9000);
    } catch (error) {
      // Migration may not have been run yet. Chat continuity must degrade safely.
      this.logger.warn(
        `[conversation memory] prompt context unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return '';
    }
  }

  async getRecoveredRequirements(
    conversationId: number,
    userId: number | null,
    currentMessage: string,
  ): Promise<AgentRequirements> {
    try {
      let row = await this.database.queryOne<MemoryRow>(
        `SELECT conversation_id AS "conversationId", user_id AS "userId",
                rolling_summary AS "rollingSummary",
                current_goal AS "currentGoal",
                unresolved_context AS "unresolvedContext",
                recent_entities AS "recentEntities",
                correction_notes AS "correctionNotes",
                last_intent AS "lastIntent",
                last_requirements AS "lastRequirements",
                last_pending_action AS "lastPendingAction",
                last_user_message AS "lastUserMessage",
                last_assistant_message AS "lastAssistantMessage",
                turn_count AS "turnCount", updated_at AS "updatedAt"
         FROM ai_conversation_memories WHERE conversation_id = $1`,
        [conversationId],
      );
      if (
        !row &&
        userId !== null &&
        this.referencesEarlierConversation(currentMessage)
      ) {
        row = await this.database.queryOne<MemoryRow>(
          `SELECT conversation_id AS "conversationId", user_id AS "userId",
                  rolling_summary AS "rollingSummary",
                  current_goal AS "currentGoal",
                  unresolved_context AS "unresolvedContext",
                  recent_entities AS "recentEntities",
                  correction_notes AS "correctionNotes",
                  last_intent AS "lastIntent",
                  last_requirements AS "lastRequirements",
                  last_pending_action AS "lastPendingAction",
                  last_user_message AS "lastUserMessage",
                  last_assistant_message AS "lastAssistantMessage",
                  turn_count AS "turnCount", updated_at AS "updatedAt"
           FROM ai_conversation_memories
           WHERE user_id = $1 AND conversation_id <> $2
           ORDER BY updated_at DESC LIMIT 1`,
          [userId, conversationId],
        );
      }
      if (!row) return {};

      const source = row.lastRequirements ?? {};
      const entities = row.recentEntities ?? {};
      return {
        budgetMin: source.budgetMin,
        budgetMax:
          source.budgetMax ??
          (typeof entities.budgetMax === 'number'
            ? entities.budgetMax
            : undefined),
        recommendationCount: source.recommendationCount,
        numberOfPlots: source.numberOfPlots,
        preferredZone:
          source.preferredZone ??
          (typeof entities.preferredZone === 'string'
            ? entities.preferredZone
            : undefined),
        preferredDirection:
          source.preferredDirection ??
          (typeof entities.preferredDirection === 'string'
            ? entities.preferredDirection
            : undefined),
        plotType: source.plotType,
        minAreaSqm: source.minAreaSqm,
        maxAreaSqm: source.maxAreaSqm,
        needAdjacent: source.needAdjacent,
        preferNearEntrance: source.preferNearEntrance,
        serviceQuery:
          source.serviceQuery ??
          (typeof entities.serviceQuery === 'string'
            ? entities.serviceQuery
            : typeof entities.serviceName === 'string'
              ? entities.serviceName
              : undefined),
        selectedPlotCode:
          source.selectedPlotCode ??
          (Array.isArray(entities.plotCodes) && entities.plotCodes.length
            ? String(entities.plotCodes[entities.plotCodes.length - 1])
            : undefined),
      };
    } catch {
      return {};
    }
  }

  async recordTurnSnapshot(input: TurnSnapshotInput) {
    try {
      const userMessage =
        input.userMessage?.trim() ||
        (input.userMessageId
          ? await this.loadMessageContent(input.userMessageId)
          : '') ||
        '';
      const existing = await this.database.queryOne<MemoryRow>(
        `SELECT conversation_id AS "conversationId", user_id AS "userId",
                rolling_summary AS "rollingSummary",
                current_goal AS "currentGoal",
                unresolved_context AS "unresolvedContext",
                recent_entities AS "recentEntities",
                correction_notes AS "correctionNotes",
                last_intent AS "lastIntent",
                last_requirements AS "lastRequirements",
                last_pending_action AS "lastPendingAction",
                last_user_message AS "lastUserMessage",
                last_assistant_message AS "lastAssistantMessage",
                turn_count AS "turnCount", updated_at AS "updatedAt"
         FROM ai_conversation_memories
         WHERE conversation_id = $1`,
        [input.conversationId],
      );

      // Do not decide "this is a correction" by keyword here. Keep the last
      // semantic corrections until the background LLM summary refresh updates
      // them from the complete transcript.
      const correctionNotes = existing?.correctionNotes ?? [];
      const recentEntities = this.mergeEntities(
        existing?.recentEntities ?? {},
        input.requirements,
        input.pendingAction,
        userMessage,
      );
      const currentGoal = this.goalForIntent(input.intent, input.pendingAction);
      const unresolvedContext = this.unresolvedForTurn(
        input.assistantMessage,
        input.pendingAction,
      );
      const rollingSummary = this.deterministicSummary(
        existing?.rollingSummary ?? '',
        userMessage,
        input.assistantMessage,
        currentGoal,
        correctionNotes,
      );

      await this.database.query(
        `INSERT INTO ai_conversation_memories
           (conversation_id, user_id, rolling_summary, current_goal,
            unresolved_context, recent_entities, correction_notes,
            last_intent, last_requirements, last_pending_action,
            last_user_message, last_assistant_message, turn_count,
            updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb,
                 $10::jsonb, $11, $12, 1, NOW())
         ON CONFLICT (conversation_id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           rolling_summary = EXCLUDED.rolling_summary,
           current_goal = EXCLUDED.current_goal,
           unresolved_context = EXCLUDED.unresolved_context,
           recent_entities = EXCLUDED.recent_entities,
           correction_notes = EXCLUDED.correction_notes,
           last_intent = EXCLUDED.last_intent,
           last_requirements = EXCLUDED.last_requirements,
           last_pending_action = EXCLUDED.last_pending_action,
           last_user_message = EXCLUDED.last_user_message,
           last_assistant_message = EXCLUDED.last_assistant_message,
           turn_count = ai_conversation_memories.turn_count + 1,
           updated_at = NOW()`,
        [
          input.conversationId,
          input.userId,
          rollingSummary,
          currentGoal,
          unresolvedContext,
          JSON.stringify(recentEntities),
          JSON.stringify(correctionNotes),
          input.intent,
          JSON.stringify(input.requirements ?? {}),
          JSON.stringify(
            input.pendingAction ?? input.requirements.pendingAction ?? null,
          ),
          userMessage.slice(0, 4000),
          input.assistantMessage.slice(0, 6000),
        ],
      );

      // Keep the request fast. The deterministic snapshot above is already
      // available immediately; the LLM only improves the rolling summary later.
      if (this.llm.isConfigured()) {
        void this.refreshSemanticSummary(input.conversationId).catch((error) =>
          this.logger.debug(
            `[conversation memory] semantic refresh skipped: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    } catch (error) {
      this.logger.warn(
        `[conversation memory] snapshot unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async refreshSemanticSummary(conversationId: number) {
    const messages = await this.database.query<{
      role: 'user' | 'assistant';
      content: string;
    }>(
      `WITH reset_boundary AS (
         SELECT MAX(message_id) AS reset_message_id
         FROM ai_messages
         WHERE conversation_id = $1
           AND metadata ->> 'memoryResetBoundary' = 'true'
       )
       SELECT role, content
       FROM ai_messages, reset_boundary
       WHERE conversation_id = $1
         AND role IN ('user', 'assistant')
         AND (
           reset_boundary.reset_message_id IS NULL
           OR message_id > reset_boundary.reset_message_id
         )
       ORDER BY created_at DESC, message_id DESC
       LIMIT 18`,
      [conversationId],
    );
    if (messages.length < 2) return;

    const transcript = messages
      .reverse()
      .map(
        (item) =>
          `${item.role === 'user' ? 'Khách' : 'Trợ lý'}: ${item.content}`,
      )
      .join('\n')
      .slice(-9000);
    const response = await this.llm.chat(
      [
        {
          role: 'system',
          content: `Bạn là bộ nhớ hội thoại ngắn hạn của trợ lý Vĩnh Phúc Viên. Đọc transcript theo NGỮ NGHĨA, không dò từ khóa, rồi trả DUY NHẤT JSON hợp lệ:
{"rollingSummary":"...","currentGoal":"...","unresolvedContext":"...","correctionNotes":["..."]}

Quy tắc:
- Chỉ ghi điều thực sự xuất hiện trong transcript.
- rollingSummary tối đa khoảng 180 từ, ưu tiên mục tiêu hiện tại, thứ đang chờ, và dữ kiện cần nối tiếp.
- currentGoal là mục tiêu hiện tại của người dùng; để "" nếu chưa rõ.
- unresolvedContext là câu hỏi/việc còn chờ giải quyết; để "" nếu không có.
- correctionNotes chỉ chứa những lần người dùng thực sự sửa cách trợ lý hiểu ý/ngữ cảnh hoặc chỉ ra một lỗi hội thoại. Nhận biết cả cách nói gián tiếp; KHÔNG yêu cầu từ khóa "sai", "hiểu sai", "không đúng".
- Một lần người dùng đổi ý bình thường không phải correction.
- correctionNotes phải được khái quát ngắn gọn, không chép dữ liệu cá nhân/nhạy cảm, không biến đàm phán giá hay lựa chọn giao dịch thành sở thích lâu dài.
- Không suy diễn trạng thái thanh toán, lô, dịch vụ hoặc nghiệp vụ nếu backend chưa xác nhận.
- Không markdown, không thêm chữ ngoài JSON.`,
        },
        { role: 'user', content: transcript },
      ],
      [],
      'auto',
      {
        temperature: 0,
        maxTokens: 500,
        routingKey: `conversation-memory:${conversationId}`,
        timeoutMs: 5_000,
        totalTimeoutMs: 6_500,
        preferredProviderId: 'groq-20b',
        strictPreferredProvider: false,
      },
    );
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return;
    const parsed = this.parseSemanticMemory(raw);
    if (!parsed) return;
    await this.database.query(
      `UPDATE ai_conversation_memories
       SET rolling_summary = $2,
           current_goal = NULLIF($3, ''),
           unresolved_context = NULLIF($4, ''),
           correction_notes = $5::jsonb,
           summary_model = $6,
           summary_updated_at = NOW(),
           updated_at = NOW()
       WHERE conversation_id = $1`,
      [
        conversationId,
        parsed.rollingSummary.slice(0, 5000),
        parsed.currentGoal.slice(0, 1200),
        parsed.unresolvedContext.slice(0, 1800),
        JSON.stringify(parsed.correctionNotes.slice(-8)),
        response.model ?? this.llm.model,
      ],
    );
  }

  private parseSemanticMemory(raw: string) {
    const candidate = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) return;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      const clean = (value: unknown, max: number) =>
        typeof value === 'string'
          ? value.replace(/\s+/g, ' ').trim().slice(0, max)
          : '';
      const correctionNotes = Array.isArray(parsed.correctionNotes)
        ? parsed.correctionNotes
            .filter((item): item is string => typeof item === 'string')
            .map((item) => clean(item, 600))
            .filter(Boolean)
            .slice(-8)
        : [];
      return {
        rollingSummary: clean(parsed.rollingSummary, 5000),
        currentGoal: clean(parsed.currentGoal, 1200),
        unresolvedContext: clean(parsed.unresolvedContext, 1800),
        correctionNotes: [...new Set(correctionNotes)],
      };
    } catch {
      return;
    }
  }

  private async loadMessageContent(messageId: number) {
    const row = await this.database.queryOne<{ content: string | null }>(
      `SELECT content FROM ai_messages WHERE message_id = $1`,
      [messageId],
    );
    return row?.content ?? '';
  }

  private referencesEarlierConversation(message: string) {
    const folded = this.fold(message);
    return /\b(?:hoi nay|luc nay|ban nay|nay do|cai nay|cai do|y nay|y do|luc truoc|hoi truoc|lan truoc|hom truoc|nhu da noi|nhu minh noi|nhu toi noi|tiep tuc|noi tiep|do ma)\b/.test(
      folded,
    );
  }

  private renderMemory(row: MemoryRow, compact = false) {
    const lines = [
      row.rollingSummary ? `Summary: ${row.rollingSummary}` : '',
      row.currentGoal ? `Current goal: ${row.currentGoal}` : '',
      row.unresolvedContext ? `Unresolved: ${row.unresolvedContext}` : '',
      row.lastIntent ? `Last intent: ${row.lastIntent}` : '',
      !compact &&
      row.lastRequirements &&
      Object.keys(row.lastRequirements).length
        ? `Last structured requirements: ${JSON.stringify(row.lastRequirements)}`
        : '',
      row.recentEntities && Object.keys(row.recentEntities).length
        ? `Recent entities: ${JSON.stringify(row.recentEntities)}`
        : '',
      row.correctionNotes?.length
        ? `User corrections/complaints: ${row.correctionNotes.slice(-4).join(' | ')}`
        : '',
      !compact && row.lastUserMessage
        ? `Last user message: ${row.lastUserMessage}`
        : '',
      !compact && row.lastAssistantMessage
        ? `Last assistant message: ${row.lastAssistantMessage}`
        : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  private goalForIntent(intent: string, pendingAction?: AgentPendingAction) {
    if (pendingAction?.kind === 'service_order') {
      return `Hoàn tất đặt dịch vụ${pendingAction.serviceName ? ` ${pendingAction.serviceName}` : ''}${pendingAction.plotCode ? ` cho lô ${pendingAction.plotCode}` : ''}`;
    }
    if (pendingAction?.kind === 'plot_request') {
      return `Hoàn tất yêu cầu mua lô ${pendingAction.plotCodes.join(', ')}`.trim();
    }
    if (pendingAction?.kind === 'appointment')
      return 'Hoàn tất đặt lịch với ban quản lý';
    if (pendingAction?.kind === 'memorial_reminder')
      return 'Hoàn tất tạo lịch nhắc tưởng niệm';
    const labels: Record<string, string> = {
      recommend_plots: 'Tìm và so sánh lô phù hợp',
      service_booking: 'Đặt dịch vụ nghĩa trang',
      service_suggestions: 'Tìm hiểu dịch vụ nghĩa trang',
      plot_request: 'Tạo yêu cầu mua lô',
      bazi_suggestion: 'Tư vấn Bát Tự/phong thủy tham khảo',
      purchase_process: 'Tìm hiểu quy trình mua lô',
      plot_details: 'Kiểm tra thông tin lô',
      customer_care: 'Theo dõi chăm sóc khách hàng',
    };
    return labels[intent] ?? 'Tiếp tục tư vấn theo ngữ cảnh hiện tại';
  }

  private unresolvedForTurn(
    assistantMessage: string,
    pendingAction?: AgentPendingAction,
  ) {
    if (pendingAction) {
      const stage =
        pendingAction.stage === 'awaiting_confirmation'
          ? 'đang chờ khách xác nhận'
          : 'đang thu thập thông tin';
      return `${this.goalForIntent('', pendingAction)} — ${stage}.`;
    }
    const lastQuestion = assistantMessage
      .split(/(?<=[?.!])\s+/)
      .reverse()
      .find((part) => part.includes('?'));
    return lastQuestion?.slice(0, 600) ?? null;
  }

  private mergeEntities(
    existing: Record<string, unknown>,
    requirements: AgentRequirements,
    pendingAction: AgentPendingAction | undefined,
    userMessage: string,
  ) {
    const plotCodes = new Set<string>();
    const existingCodes = Array.isArray(existing.plotCodes)
      ? existing.plotCodes
      : [];
    for (const code of existingCodes) plotCodes.add(String(code));
    for (const match of userMessage.matchAll(
      /\b[a-z]\s*-\s*\d{1,3}\s*-\s*\d{1,3}\b/gi,
    )) {
      plotCodes.add(match[0].replace(/\s/g, '').toUpperCase());
    }
    if (requirements.selectedPlotCode)
      plotCodes.add(requirements.selectedPlotCode);
    if (pendingAction?.kind === 'plot_request') {
      pendingAction.plotCodes.forEach((code) => plotCodes.add(code));
    }
    if (pendingAction?.kind === 'service_order' && pendingAction.plotCode) {
      plotCodes.add(pendingAction.plotCode);
    }

    return {
      ...existing,
      ...(plotCodes.size ? { plotCodes: [...plotCodes].slice(-10) } : {}),
      ...(requirements.serviceQuery
        ? { serviceQuery: requirements.serviceQuery }
        : {}),
      ...(pendingAction?.kind === 'service_order' && pendingAction.serviceName
        ? { serviceName: pendingAction.serviceName }
        : {}),
      ...(requirements.budgetMax ? { budgetMax: requirements.budgetMax } : {}),
      ...(requirements.preferredZone
        ? { preferredZone: requirements.preferredZone }
        : {}),
      ...(requirements.preferredDirection
        ? { preferredDirection: requirements.preferredDirection }
        : {}),
    };
  }

  private deterministicSummary(
    previous: string,
    userMessage: string,
    assistantMessage: string,
    currentGoal: string,
    corrections: string[],
  ) {
    const newest = [
      `Mục tiêu: ${currentGoal}.`,
      userMessage ? `Khách vừa nói: ${userMessage.slice(0, 600)}` : '',
      `Trợ lý vừa trả lời: ${assistantMessage.slice(0, 900)}`,
      corrections.length
        ? `Lưu ý sửa sai gần đây: ${corrections.slice(-2).join(' | ')}`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    const combined = previous ? `${previous}\n${newest}` : newest;
    return combined.slice(-5000);
  }

  private fold(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
