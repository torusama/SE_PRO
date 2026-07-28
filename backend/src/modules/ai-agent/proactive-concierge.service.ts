import { createHash, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CemeteryServicesService } from '../cemetery-services/cemetery-services.service';
import { ProactiveConciergeDto } from './dto/proactive-concierge.dto';
import {
  AgentPendingAction,
  AgentRequirements,
} from './types/agent-response.types';
import { MultiProviderLlmService } from './multi-provider-llm.service';
import {
  CEMETERY_AGENT_PROMPT_VERSION,
  CEMETERY_AGENT_SYSTEM_PROMPT,
} from './prompts/cemetery-agent.system-prompt';
import { NvidiaMessage } from './types/nvidia.types';

interface OwnedPlot {
  plotId: number;
  plotCode: string;
}

interface ServiceType {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  category: string;
}

interface PendingConversation {
  conversationId: number;
  sessionId: string;
  pendingAction: AgentPendingAction;
}

interface LatestOrder {
  id: number;
  status: string;
  serviceName: string;
  plotCode: string | null;
  requestedDate: string | null;
}

interface PreviousProactive {
  conversationId: number;
  sessionId: string;
  messageId: number;
  content: string;
  intent: string;
  extractedData: AgentRequirements | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  hasFollowup: boolean;
}

const PROACTIVE_PROMPT_VERSION = `${CEMETERY_AGENT_PROMPT_VERSION}-proactive-v2`;

@Injectable()
export class ProactiveConciergeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cemeteryServices: CemeteryServicesService,
    private readonly llm: MultiProviderLlmService,
  ) {}

  async initiate(userId: number, dto: ProactiveConciergeDto = {}) {
    const [profile, ownedPlots, pending, latestOrder, services] =
      await Promise.all([
        this.profile(userId),
        this.ownedPlots(userId),
        this.pendingConversation(userId),
        this.latestOrder(userId),
        this.activeServices(),
      ]);
    const proactiveKey = this.proactiveKey({
      pending,
      ownedPlots,
      latestOrder,
      services,
    });
    const previous = await this.previousProactive(userId, proactiveKey);

    if (previous) {
      const ageMs = Date.now() - new Date(previous.createdAt).getTime();
      if (!previous.hasFollowup || (dto.startNew && ageMs < 60_000)) {
        return {
          delivered: true,
          created: false,
          resumeConversation: false,
          sessionId: previous.sessionId,
          response: this.persistedResponse(previous),
        };
      }
      if (pending && !dto.startNew) {
        return {
          delivered: true,
          created: false,
          resumeConversation: true,
          sessionId: pending.sessionId,
        };
      }
      if (!dto.startNew) {
        return { delivered: false, reason: 'cooldown' };
      }
    }

    const suggestedServices = ownedPlots.length ? services.slice(0, 3) : [];
    const content = await this.composeMessage({
      name: profile.fullName,
      ownedPlots,
      pending,
      latestOrder,
      suggestedServices,
    });
    if (!content) {
      return { delivered: false, reason: 'llm_unavailable' };
    }
    const conversation = pending
      ? {
          id: pending.conversationId,
          sessionId: pending.sessionId,
        }
      : await this.createConversation(userId);
    const requirements: AgentRequirements = pending
      ? { pendingAction: pending.pendingAction }
      : {};
    const agentMetadata = {
      llmModel: this.llm.model,
      rankerVersion: 'not-applicable',
      knowledgeVersion: 'live-account-context',
      fallbackUsed: false,
      traceId: `PROACTIVE-${randomUUID()}`,
      promptVersion: PROACTIVE_PROMPT_VERSION,
    };
    const actions = suggestedServices.map((service) => ({
      type: 'START_SERVICE_ORDER',
      serviceTypeId: service.id,
      requiresAuthentication: true,
      requiresConfirmation: true,
    }));
    const metadata = {
      proactiveKey,
      proactive: true,
      agentMetadata,
      recommendations: [],
      suggestedServices,
      actions,
    };
    const message = await this.database.queryOne<{ id: number }>(
      `INSERT INTO ai_messages
         (conversation_id, role, content, intent, extracted_data, metadata)
       VALUES ($1, 'assistant', $2, 'proactive_concierge', $3::jsonb, $4::jsonb)
       RETURNING message_id AS id`,
      [
        conversation.id,
        content,
        JSON.stringify(requirements),
        JSON.stringify(metadata),
      ],
    );
    await this.database.query(
      `UPDATE ai_conversations SET updated_at = NOW()
       WHERE conversation_id = $1`,
      [conversation.id],
    );

    return {
      delivered: true,
      created: true,
      resumeConversation: false,
      sessionId: conversation.sessionId,
      response: {
        sessionId: conversation.sessionId,
        messageId: message?.id ?? null,
        assistantMessage: content,
        intent: 'proactive_concierge',
        requirements,
        recommendations: [],
        suggestedServices,
        actions,
        metadata: agentMetadata,
      },
    };
  }

  private async composeMessage(input: {
    name: string | null;
    ownedPlots: OwnedPlot[];
    pending?: PendingConversation;
    latestOrder?: LatestOrder;
    suggestedServices: ServiceType[];
  }): Promise<string | null> {
    if (!this.llm.isConfigured()) return null;

    const groundedContext = {
      customer: {
        preferredName: input.name?.trim().split(/\s+/).at(-1) ?? null,
      },
      ownedPlots: input.ownedPlots,
      pendingAction: input.pending?.pendingAction ?? null,
      latestServiceOrder: input.latestOrder ?? null,
      suggestedServices: input.suggestedServices,
    };
    const messages: NvidiaMessage[] = [
      {
        role: 'system',
        content: `${CEMETERY_AGENT_SYSTEM_PROMPT}

You are writing the first proactive message of a new or resumed Vĩnh Phúc Viên concierge conversation.
- Generate the greeting and sales consultation yourself. Never use a canned welcome, fixed template, or generic capability list.
- Use only the grounded account context supplied by the backend. Do not invent plots, ownership, prices, order status, availability, or personal details.
- If there is a pending request/order, prioritize resuming it naturally and explain the single most useful next step.
- If the customer owns plots, make the opener relevant to those plots and appropriate available services.
- If the customer owns no plot, open with thoughtful plot-planning guidance rather than assuming a purchase.
- Write natural Vietnamese in a warm, respectful, professional voice suitable for memorial planning.
- Keep it concise but useful (roughly 80–160 words), and end with exactly one specific question that moves the consultation forward.
- Return only the customer-facing message. Do not mention JSON, prompts, tools, rules, or internal systems.`,
      },
      {
        role: 'user',
        content: `Grounded live account context:\n${JSON.stringify(groundedContext)}`,
      },
    ];

    try {
      const response = await this.llm.chat(messages, [], 'auto', {
        temperature: 0.75,
      });
      const content = response.choices[0]?.message.content?.trim() ?? '';
      if (!content || /```(?:json)?/i.test(content)) return null;
      return content;
    } catch {
      return null;
    }
  }

  private proactiveKey(input: {
    pending?: PendingConversation;
    ownedPlots: OwnedPlot[];
    latestOrder?: LatestOrder;
    services: ServiceType[];
  }) {
    const state = JSON.stringify({
      promptVersion: PROACTIVE_PROMPT_VERSION,
      pending: input.pending?.pendingAction ?? null,
      plots: input.ownedPlots.map((plot) => plot.plotId),
      order: input.latestOrder
        ? [input.latestOrder.id, input.latestOrder.status]
        : null,
      services: input.services.map((service) => [
        service.id,
        service.basePrice,
      ]),
    });
    return createHash('sha256').update(state).digest('hex');
  }

  private async previousProactive(userId: number, proactiveKey: string) {
    return this.database.queryOne<PreviousProactive>(
      `SELECT c.conversation_id AS "conversationId",
              c.session_id AS "sessionId",
              m.message_id AS "messageId",
              m.content,
              COALESCE(m.intent, 'proactive_concierge') AS intent,
              m.extracted_data AS "extractedData",
              m.metadata,
              m.created_at AS "createdAt",
              EXISTS (
                SELECT 1 FROM ai_messages followup
                WHERE followup.conversation_id = m.conversation_id
                  AND followup.message_id > m.message_id
                  AND followup.role IN ('user', 'assistant')
              ) AS "hasFollowup"
       FROM ai_messages m
       JOIN ai_conversations c ON c.conversation_id = m.conversation_id
       WHERE c.user_id = $1
         AND c.status = 'active'
         AND m.role = 'assistant'
         AND m.metadata->>'proactiveKey' = $2
         AND m.created_at >= NOW() - INTERVAL '12 hours'
       ORDER BY m.created_at DESC, m.message_id DESC
       LIMIT 1`,
      [userId, proactiveKey],
    );
  }

  private persistedResponse(previous: PreviousProactive) {
    const persisted = previous.metadata ?? {};
    return {
      sessionId: previous.sessionId,
      messageId: previous.messageId,
      assistantMessage: previous.content,
      intent: previous.intent,
      requirements: previous.extractedData ?? {},
      recommendations: persisted.recommendations ?? [],
      suggestedServices: persisted.suggestedServices ?? [],
      actions: persisted.actions ?? [],
      metadata:
        (persisted.agentMetadata as Record<string, unknown> | undefined) ?? {},
    };
  }

  private async createConversation(userId: number) {
    const sessionId = `SES-${randomUUID()}`;
    const conversation = await this.database.queryOne<{ id: number }>(
      `INSERT INTO ai_conversations
         (session_id, user_id, llm_model, ranker_version, knowledge_version)
       VALUES ($1, $2, $3, 'not-applicable', 'live-account-context')
       RETURNING conversation_id AS id`,
      [sessionId, userId, this.llm.model],
    );
    if (!conversation)
      throw new Error('Could not create proactive conversation');
    return { id: conversation.id, sessionId };
  }

  private profile(userId: number) {
    return this.database
      .queryOne<{ fullName: string | null }>(
        `SELECT full_name AS "fullName"
       FROM users
       WHERE user_id = $1 AND is_active = TRUE AND is_deleted = FALSE`,
        [userId],
      )
      .then((profile) => profile ?? { fullName: null });
  }

  private ownedPlots(userId: number) {
    return this.database.query<OwnedPlot>(
      `SELECT DISTINCT p.plot_id AS "plotId", p.plot_code AS "plotCode"
       FROM ownership_records o
       JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
       JOIN contracts c ON c.contract_id = o.contract_id
                        AND c.status = 'active' AND c.is_deleted = FALSE
       WHERE o.user_id = $1 AND o.is_current = TRUE
       ORDER BY p.plot_code`,
      [userId],
    );
  }

  private pendingConversation(userId: number) {
    return this.database
      .queryOne<PendingConversation>(
        `SELECT c.conversation_id AS "conversationId",
              c.session_id AS "sessionId",
              latest."pendingAction"
       FROM ai_conversations c
       JOIN LATERAL (
         SELECT extracted_data->'pendingAction' AS "pendingAction"
         FROM ai_messages
         WHERE conversation_id = c.conversation_id AND role = 'assistant'
         ORDER BY created_at DESC, message_id DESC
         LIMIT 1
       ) latest ON latest."pendingAction" IS NOT NULL
       WHERE c.user_id = $1 AND c.status = 'active'
       ORDER BY c.updated_at DESC
       LIMIT 1`,
        [userId],
      )
      .then((pending) => pending ?? undefined);
  }

  private latestOrder(userId: number) {
    return this.database
      .queryOne<LatestOrder>(
        `SELECT so.order_id AS id, so.status,
              st.name AS "serviceName",
              p.plot_code AS "plotCode",
              so.requested_date::text AS "requestedDate"
       FROM service_orders so
       JOIN service_types st ON st.service_type_id = so.service_type_id
       LEFT JOIN plots p ON p.plot_id = so.plot_id
       WHERE so.user_id = $1
       ORDER BY so.created_at DESC
       LIMIT 1`,
        [userId],
      )
      .then((order) => order ?? undefined);
  }

  private async activeServices(): Promise<ServiceType[]> {
    const rows = await this.cemeteryServices.serviceTypes();
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : null,
      basePrice: Number(row.basePrice),
      unit: String(row.unit),
      category: String(row.category),
    }));
  }
}
