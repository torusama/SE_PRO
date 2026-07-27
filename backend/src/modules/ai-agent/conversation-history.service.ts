import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

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
