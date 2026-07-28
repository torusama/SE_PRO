import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AdminAiActivityQueryDto } from './dto/admin-ai-activity-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';

export interface ConversationSummaryRow {
  sessionId: string;
  title: string;
  preview: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessageRow {
  messageId: number;
  role: 'user' | 'assistant';
  content: string;
  intent: string | null;
  extractedData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

@Injectable()
export class ConversationHistoryService {
  constructor(private readonly database: DatabaseService) {}

  async adminList(query: AdminAiActivityQueryDto) {
    const values: unknown[] = [];
    const conditions = [`c.status <> 'error'`];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const search = add(`%${query.search}%`);
      conditions.push(
        `(c.session_id ILIKE ${search} OR u.full_name ILIKE ${search} OR u.email ILIKE ${search})`,
      );
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM ai_conversations c
       LEFT JOIN users u ON u.user_id = c.user_id
       ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT c.conversation_id AS "conversationId",
              c.session_id AS "sessionId", c.status, c.llm_model AS "llmModel",
              c.ranker_version AS "rankerVersion",
              c.knowledge_version AS "knowledgeVersion",
              c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              u.user_id AS "customerId", u.full_name AS "customerName",
              u.email AS "customerEmail",
              COUNT(DISTINCT m.message_id) FILTER (
                WHERE m.role IN ('user', 'assistant')
              )::int AS "messageCount",
              COUNT(DISTINCT f.feedback_id)::int AS "feedbackCount",
              LEFT(last_message.content, 160) AS preview
       FROM ai_conversations c
       LEFT JOIN users u ON u.user_id = c.user_id
       LEFT JOIN ai_messages m ON m.conversation_id = c.conversation_id
       LEFT JOIN ai_feedback f ON f.conversation_id = c.conversation_id
       LEFT JOIN LATERAL (
         SELECT content FROM ai_messages
         WHERE conversation_id = c.conversation_id
           AND role IN ('user', 'assistant')
         ORDER BY created_at DESC, message_id DESC LIMIT 1
       ) last_message ON TRUE
       ${where}
       GROUP BY c.conversation_id, u.user_id, last_message.content
       ORDER BY c.updated_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async adminGet(conversationId: number) {
    const conversation = await this.database.queryOne(
      `SELECT c.conversation_id AS "conversationId",
              c.session_id AS "sessionId", c.status,
              c.llm_model AS "llmModel", c.ranker_version AS "rankerVersion",
              c.knowledge_version AS "knowledgeVersion",
              c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              u.user_id AS "customerId", u.full_name AS "customerName",
              u.email AS "customerEmail"
       FROM ai_conversations c
       LEFT JOIN users u ON u.user_id = c.user_id
       WHERE c.conversation_id = $1`,
      [conversationId],
    );
    if (!conversation) throw new NotFoundException('AI conversation not found');

    const [messages, toolCalls, feedback] = await Promise.all([
      this.database.query(
        `SELECT message_id AS "messageId", role, content, intent,
                extracted_data AS "extractedData", metadata,
                created_at AS "createdAt"
         FROM ai_messages WHERE conversation_id = $1
         ORDER BY created_at, message_id`,
        [conversationId],
      ),
      this.database.query(
        `SELECT tool_call_id AS "toolCallId", message_id AS "messageId",
                tool_name AS "toolName", input_data AS "inputData",
                output_data AS "outputData", status, error_message AS "errorMessage",
                execution_time_ms AS "executionTimeMs", created_at AS "createdAt"
         FROM ai_tool_calls WHERE conversation_id = $1
         ORDER BY created_at, tool_call_id`,
        [conversationId],
      ),
      this.database.query(
        `SELECT feedback_id AS "feedbackId", message_id AS "messageId",
                feedback_type AS "feedbackType", rating, reason,
                corrected_content AS "correctedContent",
                validation_status AS status, created_at AS "createdAt"
         FROM ai_feedback WHERE conversation_id = $1
         ORDER BY created_at DESC`,
        [conversationId],
      ),
    ]);
    return { ...conversation, messages, toolCalls, feedback };
  }

  list(userId: number) {
    return this.database.query<ConversationSummaryRow>(
      `SELECT c.session_id AS "sessionId",
              COALESCE(
                NULLIF(LEFT(first_message.content, 72), ''),
                'Cuộc trò chuyện mới'
              ) AS title,
              LEFT(last_message.content, 120) AS preview,
              COUNT(m.message_id)::int AS "messageCount",
              c.created_at AS "createdAt",
              c.updated_at AS "updatedAt"
       FROM ai_conversations c
       LEFT JOIN ai_messages m
              ON m.conversation_id = c.conversation_id
             AND m.role IN ('user', 'assistant')
       LEFT JOIN LATERAL (
         SELECT content
         FROM ai_messages
         WHERE conversation_id = c.conversation_id AND role = 'user'
         ORDER BY created_at, message_id
         LIMIT 1
       ) first_message ON TRUE
       LEFT JOIN LATERAL (
         SELECT content
         FROM ai_messages
         WHERE conversation_id = c.conversation_id
           AND role IN ('user', 'assistant')
         ORDER BY created_at DESC, message_id DESC
         LIMIT 1
       ) last_message ON TRUE
       WHERE c.user_id = $1 AND c.status = 'active'
       GROUP BY c.conversation_id, first_message.content, last_message.content
       ORDER BY c.updated_at DESC
       LIMIT 100`,
      [userId],
    );
  }

  async get(userId: number, sessionId: string) {
    const conversation = await this.database.queryOne<{
      conversationId: number;
      sessionId: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `SELECT conversation_id AS "conversationId",
              session_id AS "sessionId",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM ai_conversations
       WHERE session_id = $1 AND user_id = $2 AND status = 'active'`,
      [sessionId, userId],
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const rows = await this.database.query<ConversationMessageRow>(
      `SELECT message_id AS "messageId", role, content, intent,
              extracted_data AS "extractedData", metadata,
              created_at AS "createdAt"
       FROM ai_messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')
       ORDER BY created_at, message_id`,
      [conversation.conversationId],
    );

    return {
      sessionId: conversation.sessionId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: rows.map((message) => {
        if (message.role === 'user') return message;
        const persisted = message.metadata ?? {};
        const agentMetadata =
          (persisted.agentMetadata as Record<string, unknown> | undefined) ??
          persisted;
        return {
          ...message,
          response: {
            sessionId: conversation.sessionId,
            messageId: message.messageId,
            assistantMessage: message.content,
            intent: message.intent ?? 'conversation',
            requirements: message.extractedData ?? {},
            recommendations: persisted.recommendations ?? [],
            suggestedServices: persisted.suggestedServices ?? [],
            baziSuggestion: persisted.baziSuggestion,
            actions: persisted.actions ?? [],
            metadata: agentMetadata,
          },
        };
      }),
    };
  }

  async remove(userId: number, sessionId: string) {
    const deleted = await this.database.queryOne<{ sessionId: string }>(
      `DELETE FROM ai_conversations
       WHERE session_id = $1 AND user_id = $2
       RETURNING session_id AS "sessionId"`,
      [sessionId, userId],
    );
    if (!deleted) throw new NotFoundException('Conversation not found');
    return deleted;
  }
}
