import { BadRequestException } from '@nestjs/common';
import { AgentRequirements } from './types/agent-response.types';
import {
  MEMORY_TYPES,
  MemoryProposal,
  USER_MEMORY_KEYS,
} from './tools/agent-tool.types';

export const AGENT_PLANNER_TOOL_NAME = 'plan_cemetery_concierge_action';

export const AGENT_PLANNER_TOOL = {
  type: 'function',
  function: {
    name: AGENT_PLANNER_TOOL_NAME,
    description:
      'Understand the complete Vietnamese conversation and choose the next safe cemetery concierge action.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        intent: {
          type: 'string',
          enum: [
            'recommend_plots',
            'service_suggestions',
            'plot_request',
            'service_booking',
            'purchase_process',
            'bazi_suggestion',
            'plot_competitiveness',
            'customer_care',
            'appointment_booking',
            'memorial_reminder',
            'general_question',
          ],
        },
        action: {
          type: 'string',
          enum: [
            'rank_plot_options',
            'browse_available_plots',
            'get_service_suggestions',
            'prepare_plot_request',
            'prepare_service_order',
            'cancel_service_order',
            'confirm_pending_action',
            'cancel_pending_action',
            'get_purchase_process',
            'suggest_bazi_direction',
            'analyze_plot_competitiveness',
            'get_customer_care_overview',
            'prepare_appointment',
            'prepare_memorial_reminder',
            'none',
          ],
        },
        contextMode: {
          type: 'string',
          enum: ['continue', 'replace', 'relax'],
          description:
            'How the current turn relates to the active request. Return the fully resolved active requirements regardless of mode.',
        },
        needsClarification: { type: 'boolean' },
        clarificationQuestion: { type: 'string' },
        directResponse: {
          type: 'string',
          maxLength: 4000,
          description:
            'For action=none, write the final natural response to the user here so the backend can answer in one LLM call. Do not claim persistence succeeded; the backend appends trusted memory outcomes separately. Omit or leave empty for tool actions.',
        },
        budgetMin: { type: 'number', minimum: 0 },
        budgetMax: {
          type: 'number',
          minimum: 1,
          description:
            'The customer total maximum budget in VND. Treat colloquial "củ" as millions.',
        },
        numberOfPlots: { type: 'integer', minimum: 1 },
        recommendationCount: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description:
            'Exact number of alternative recommendation options/cards explicitly requested by the customer. This is not the acquisition quantity.',
        },
        comparisonRequested: {
          type: 'boolean',
          description:
            'True when the customer explicitly asks to compare or contrast options.',
        },
        preferredZone: {
          type: 'string',
          description:
            'Canonical cemetery zone such as "Khu A". Omit when absent.',
        },
        preferredDirection: { type: 'string' },
        plotType: {
          type: 'string',
          enum: ['single', 'double', 'family'],
        },
        minAreaSqm: {
          type: 'number',
          minimum: 0,
          description: 'Omit unless the user specifies a minimum area.',
        },
        maxAreaSqm: {
          type: 'number',
          minimum: 0,
          description: 'Omit unless the user specifies a maximum area.',
        },
        needAdjacent: {
          type: 'boolean',
          description:
            'True when the user asks for adjacent, neighboring, side-by-side, "liền kề", "liền nhau", "cạnh nhau", "kế nhau", or family plots. Omit when not discussed.',
        },
        preferNearEntrance: {
          type: 'boolean',
          description:
            'True when the customer prioritizes a plot near an entrance or asks for easier access from a gate. Preserve it across follow-up turns until the customer changes that preference.',
        },
        birthDate: { type: 'string' },
        birthTime: { type: 'string' },
        gender: {
          type: 'string',
          enum: ['male', 'female', 'other'],
        },
        zodiacSign: {
          type: 'string',
          description:
            'Vietnamese zodiac sign understood from the customer, such as Mão or Tuất. Soft narrative context only, never an invented inventory filter.',
        },
        consultationGoal: {
          type: 'string',
          enum: ['bazi_then_plots'],
          description:
            'Preserve this multi-turn goal when the customer wants plot advice based on age/zodiac: collect Bát Tự inputs, analyze directions, then search inventory.',
        },
        serviceQuery: {
          type: 'string',
          description:
            'The cemetery service name or natural-language description requested by the customer.',
        },
        serviceQueries: {
          type: 'array',
          maxItems: 8,
          items: { type: 'string' },
          description:
            'Every distinct service name when the customer explicitly asks to order several services together. Preserve their spoken order. Omit for a single service.',
        },
        serviceTypeId: { type: 'integer', minimum: 1 },
        serviceOrderId: {
          type: 'integer',
          minimum: 1,
          description: 'Exact existing service order id named by the customer.',
        },
        selectedPlotCode: { type: 'string' },
        requestedDate: {
          type: 'string',
          description:
            'Requested service date in YYYY-MM-DD format. Resolve relative Vietnamese dates from the current date supplied by the system.',
        },
        appointmentDate: {
          type: 'string',
          description: 'Requested meeting date in YYYY-MM-DD format.',
        },
        appointmentStartTime: {
          type: 'string',
          description: 'Requested meeting start time in HH:mm format.',
        },
        appointmentEndTime: {
          type: 'string',
          description: 'Requested meeting end time in HH:mm format.',
        },
        appointmentTopic: { type: 'string', maxLength: 300 },
        reminderTitle: { type: 'string', maxLength: 200 },
        reminderDescription: {
          type: 'string',
          maxLength: 1800,
          description:
            'Respectful Vietnamese memorial email body drafted for the family. Keep it warm, specific and free of invented facts.',
        },
        reminderDate: {
          type: 'string',
          description: 'One-time reminder date in YYYY-MM-DD format.',
        },
        reminderRecurring: { type: 'boolean' },
        reminderCalendarType: {
          type: 'string',
          enum: ['solar', 'lunar'],
        },
        reminderNotifyDaysBefore: {
          type: 'integer',
          minimum: 0,
          maximum: 30,
        },
        reminderNotifyEmails: {
          type: 'array',
          maxItems: 10,
          items: { type: 'string' },
        },
        note: { type: 'string', maxLength: 1000 },
        memoryProposals: {
          type: 'array',
          description:
            'Optional knowledge updates or memory proposals detected from the user message. Use this to remember preferences or capture learning signals while still completing the primary action.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              category: { type: 'string', minLength: 1, maxLength: 50 },
              title: { type: 'string', minLength: 1, maxLength: 200 },
              content: { type: 'string', minLength: 1, maxLength: 5000 },
              memoryType: {
                type: 'string',
                enum: MEMORY_TYPES,
              },
              requestedScope: { type: 'string', enum: ['user', 'global'] },
              memoryKey: {
                type: 'string',
                enum: USER_MEMORY_KEYS,
                description:
                  'Stable replacement key for a user preference. Omit for non-preference knowledge.',
              },
              reason: { type: 'string', minLength: 1, maxLength: 1000 },
              effectiveFrom: {
                type: 'string',
                description:
                  'Optional ISO-8601 effective start extracted from the message.',
              },
              effectiveTo: {
                type: 'string',
                description:
                  'Optional ISO-8601 effective end extracted from the message.',
              },
              selectedOptionId: {
                type: 'string',
                maxLength: 100,
                description:
                  'For recommendation feedback only; a user-reported option label or ID.',
              },
              rejectedOptionId: {
                type: 'string',
                maxLength: 100,
                description:
                  'For recommendation feedback only; a user-reported rejected option label or ID.',
              },
            },
            required: [
              'category',
              'title',
              'content',
              'memoryType',
              'requestedScope',
              'reason',
            ],
          },
        },
      },
      required: [
        'intent',
        'action',
        'contextMode',
        'needsClarification',
        'clarificationQuestion',
        'directResponse',
      ],
    },
  },
} as const;

export type AgentPlanIntent =
  | 'recommend_plots'
  | 'service_suggestions'
  | 'plot_request'
  | 'service_booking'
  | 'purchase_process'
  | 'bazi_suggestion'
  | 'plot_competitiveness'
  | 'customer_care'
  | 'appointment_booking'
  | 'memorial_reminder'
  | 'general_question';

export type AgentPlanAction =
  | 'rank_plot_options'
  | 'browse_available_plots'
  | 'get_service_suggestions'
  | 'prepare_plot_request'
  | 'prepare_service_order'
  | 'cancel_service_order'
  | 'confirm_pending_action'
  | 'cancel_pending_action'
  | 'get_purchase_process'
  | 'suggest_bazi_direction'
  | 'analyze_plot_competitiveness'
  | 'get_customer_care_overview'
  | 'prepare_appointment'
  | 'prepare_memorial_reminder'
  | 'none';

export interface AgentPlan {
  intent: AgentPlanIntent;
  action: AgentPlanAction;
  contextMode: 'continue' | 'replace' | 'relax';
  needsClarification: boolean;
  clarificationQuestion: string;
  directResponse?: string;
  requirements: AgentRequirements;
  memoryProposals?: MemoryProposal[];
}

const INTENTS = new Set<AgentPlanIntent>([
  'recommend_plots',
  'service_suggestions',
  'plot_request',
  'service_booking',
  'purchase_process',
  'bazi_suggestion',
  'plot_competitiveness',
  'customer_care',
  'appointment_booking',
  'memorial_reminder',
  'general_question',
]);
const ACTIONS = new Set<AgentPlanAction>([
  'rank_plot_options',
  'browse_available_plots',
  'get_service_suggestions',
  'prepare_plot_request',
  'prepare_service_order',
  'cancel_service_order',
  'confirm_pending_action',
  'cancel_pending_action',
  'get_purchase_process',
  'suggest_bazi_direction',
  'analyze_plot_competitiveness',
  'get_customer_care_overview',
  'prepare_appointment',
  'prepare_memorial_reminder',
  'none',
]);

function optionalPositiveNumber(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function boundedProposalString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  const lowered = normalized.toLowerCase();
  if (
    !normalized ||
    normalized.length > maxLength ||
    lowered === 'undefined' ||
    lowered === 'null'
  ) {
    return undefined;
  }
  return normalized;
}

function parseMemoryProposals(value: unknown): MemoryProposal[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const proposals: MemoryProposal[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const category = boundedProposalString(record.category, 50);
    const title = boundedProposalString(record.title, 200);
    const content = boundedProposalString(record.content, 5000);
    const reason = boundedProposalString(record.reason, 1000);
    if (
      !category ||
      !title ||
      !content ||
      !reason ||
      !MEMORY_TYPES.includes(
        record.memoryType as (typeof MEMORY_TYPES)[number],
      ) ||
      (record.requestedScope !== 'user' && record.requestedScope !== 'global')
    ) {
      continue;
    }
    const memoryKey = USER_MEMORY_KEYS.includes(
      record.memoryKey as (typeof USER_MEMORY_KEYS)[number],
    )
      ? (record.memoryKey as (typeof USER_MEMORY_KEYS)[number])
      : undefined;
    proposals.push({
      category,
      title,
      content,
      memoryType: record.memoryType as MemoryProposal['memoryType'],
      requestedScope: record.requestedScope,
      memoryKey,
      reason,
      effectiveFrom: boundedProposalString(record.effectiveFrom, 50),
      effectiveTo: boundedProposalString(record.effectiveTo, 50),
      selectedOptionId: boundedProposalString(record.selectedOptionId, 100),
      rejectedOptionId: boundedProposalString(record.rejectedOptionId, 100),
    });
  }
  return proposals.length ? proposals : undefined;
}

export function parseAgentPlan(raw: string): AgentPlan {
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Planner output must be an object');
    }
    parsed = value as Record<string, unknown>;
  } catch {
    throw new BadRequestException('Invalid NVIDIA agent plan JSON');
  }

  if (!INTENTS.has(parsed.intent as AgentPlanIntent)) {
    throw new BadRequestException('Invalid NVIDIA agent plan intent');
  }
  if (!ACTIONS.has(parsed.action as AgentPlanAction)) {
    throw new BadRequestException('Invalid NVIDIA agent plan action');
  }

  const numberOfPlots = optionalPositiveNumber(parsed.numberOfPlots);
  const recommendationCount = optionalPositiveNumber(
    parsed.recommendationCount,
  );
  const preferredZone = optionalString(parsed.preferredZone);
  const requirements: AgentRequirements = {
    budgetMin: optionalPositiveNumber(parsed.budgetMin),
    budgetMax: optionalPositiveNumber(parsed.budgetMax),
    numberOfPlots:
      numberOfPlots !== undefined && Number.isInteger(numberOfPlots)
        ? numberOfPlots
        : undefined,
    recommendationCount:
      recommendationCount !== undefined &&
      Number.isInteger(recommendationCount) &&
      recommendationCount <= 10
        ? recommendationCount
        : undefined,
    comparisonRequested:
      typeof parsed.comparisonRequested === 'boolean'
        ? parsed.comparisonRequested
        : undefined,
    preferredZone:
      preferredZone && /^[a-z]$/i.test(preferredZone)
        ? `Khu ${preferredZone.toUpperCase()}`
        : preferredZone,
    preferredDirection: optionalString(parsed.preferredDirection),
    plotType:
      parsed.plotType === 'single' ||
      parsed.plotType === 'double' ||
      parsed.plotType === 'family'
        ? parsed.plotType
        : undefined,
    minAreaSqm: optionalPositiveNumber(parsed.minAreaSqm),
    maxAreaSqm: optionalPositiveNumber(parsed.maxAreaSqm),
    needAdjacent:
      typeof parsed.needAdjacent === 'boolean'
        ? parsed.needAdjacent
        : undefined,
    preferNearEntrance:
      typeof parsed.preferNearEntrance === 'boolean'
        ? parsed.preferNearEntrance
        : undefined,
    birthDate: optionalString(parsed.birthDate),
    birthTime: optionalString(parsed.birthTime),
    gender:
      parsed.gender === 'male' ||
      parsed.gender === 'female' ||
      parsed.gender === 'other'
        ? parsed.gender
        : undefined,
    zodiacSign: optionalString(parsed.zodiacSign),
    consultationGoal:
      parsed.consultationGoal === 'bazi_then_plots'
        ? 'bazi_then_plots'
        : undefined,
    serviceQuery: optionalString(parsed.serviceQuery),
    serviceQueries: Array.isArray(parsed.serviceQueries)
      ? [
          ...new Set(
            parsed.serviceQueries
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ].slice(0, 8)
      : undefined,
    serviceTypeId:
      optionalPositiveNumber(parsed.serviceTypeId) !== undefined &&
      Number.isInteger(optionalPositiveNumber(parsed.serviceTypeId))
        ? optionalPositiveNumber(parsed.serviceTypeId)
        : undefined,
    serviceOrderId:
      optionalPositiveNumber(parsed.serviceOrderId) !== undefined &&
      Number.isInteger(optionalPositiveNumber(parsed.serviceOrderId))
        ? optionalPositiveNumber(parsed.serviceOrderId)
        : undefined,
    selectedPlotCode: optionalString(parsed.selectedPlotCode),
    requestedDate: optionalString(parsed.requestedDate),
    appointmentDate: optionalString(parsed.appointmentDate),
    appointmentStartTime: optionalString(parsed.appointmentStartTime),
    appointmentEndTime: optionalString(parsed.appointmentEndTime),
    appointmentTopic: optionalString(parsed.appointmentTopic),
    reminderTitle: optionalString(parsed.reminderTitle),
    reminderDescription: optionalString(parsed.reminderDescription),
    reminderDate: optionalString(parsed.reminderDate),
    reminderRecurring:
      typeof parsed.reminderRecurring === 'boolean'
        ? parsed.reminderRecurring
        : undefined,
    reminderCalendarType:
      parsed.reminderCalendarType === 'solar' ||
      parsed.reminderCalendarType === 'lunar'
        ? parsed.reminderCalendarType
        : undefined,
    reminderNotifyDaysBefore:
      Number.isInteger(Number(parsed.reminderNotifyDaysBefore)) &&
      Number(parsed.reminderNotifyDaysBefore) >= 0 &&
      Number(parsed.reminderNotifyDaysBefore) <= 30
        ? Number(parsed.reminderNotifyDaysBefore)
        : undefined,
    reminderNotifyEmails: Array.isArray(parsed.reminderNotifyEmails)
      ? parsed.reminderNotifyEmails
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 10)
      : undefined,
    note: optionalString(parsed.note),
  };
  if (
    requirements.budgetMin !== undefined &&
    requirements.budgetMin === requirements.budgetMax
  ) {
    delete requirements.budgetMin;
  }

  const memoryProposals = parseMemoryProposals(parsed.memoryProposals);

  return {
    intent: parsed.intent as AgentPlanIntent,
    action: parsed.action as AgentPlanAction,
    contextMode:
      parsed.contextMode === 'continue' ||
      parsed.contextMode === 'relax' ||
      parsed.contextMode === 'replace'
        ? parsed.contextMode
        : 'replace',
    needsClarification: parsed.needsClarification === true,
    clarificationQuestion: optionalString(parsed.clarificationQuestion) ?? '',
    directResponse: optionalString(parsed.directResponse),
    requirements: Object.fromEntries(
      Object.entries(requirements).filter(([, value]) => value !== undefined),
    ),
    memoryProposals,
  };
}

export function isEnglishText(text: string): boolean {
  const normalized = text.toLowerCase();
  const englishKeywords = [
    'hello',
    'please',
    'consult',
    'recommend',
    'cemetery',
    'plot',
    'price',
    'budget',
    'fengshui',
    'bazi',
    'direction',
    'family',
    'single',
    'what',
    'how',
    'where',
    'why',
    'can you',
    'i want',
    'i would like',
    'looking for',
  ];
  const hasStandaloneHi = /(?:^|[^\p{L}])hi(?:$|[^\p{L}])/u.test(normalized);
  return (
    hasStandaloneHi ||
    englishKeywords.some((keyword) => normalized.includes(keyword))
  );
}

export function recommendationDiscoveryQuestion(
  plan: AgentPlan,
  userMessage: string,
) {
  if (
    plan.action !== 'rank_plot_options' &&
    plan.action !== 'browse_available_plots'
  ) {
    return '';
  }
  const explicitlyDelegated =
    /(?:chọn|lấy|giới thiệu)\s+đại|lô\s+nào\s+cũng\s+được|bất\s+kỳ|không\s+cần\s+hỏi|tùy\s+(?:bạn|mình)|cứ\s+(?:chọn|tìm)|any plot|any option|whatever|up to you/i.test(
      userMessage,
    );
  if (explicitlyDelegated) return '';

  const isEn = isEnglishText(userMessage);
  const missingBudget = !plan.requirements.budgetMax;
  const missingCount = !plan.requirements.numberOfPlots;
  if (plan.requirements.plotType === 'family' && missingCount) {
    if (isEn) {
      return missingBudget
        ? 'For family plots, what is your approximate budget, and would you prefer a dedicated family plot or a group of adjacent plots?'
        : 'Would you prefer a dedicated family plot or a group of adjacent plots?';
    }
    return missingBudget
      ? 'Với nhu cầu dòng tộc/gia đình, bạn dự trù tổng ngân sách khoảng bao nhiêu và muốn một lô gia đình chuyên dụng hay một nhóm bao nhiêu lô liền kề?'
      : 'Bạn muốn một lô gia đình chuyên dụng hay một nhóm bao nhiêu lô liền kề cho gia đình/dòng tộc?';
  }
  if (missingBudget && missingCount) {
    return isEn
      ? 'To help me recommend the best options, could you share your approximate budget and whether you need 1 plot or multiple adjacent plots?'
      : 'Để mình giới thiệu đúng nhu cầu hơn, bạn dự trù tổng ngân sách khoảng bao nhiêu và gia đình cần 1 lô hay nhiều lô liền kề?';
  }
  if (missingBudget) {
    return isEn
      ? 'Could you share your maximum budget so I can filter the most suitable plots for you?'
      : 'Bạn dự trù tổng ngân sách tối đa khoảng bao nhiêu để mình lọc chính xác hơn?';
  }
  if (missingCount) {
    return isEn
      ? 'Do you need 1 plot or multiple adjacent plots?'
      : 'Gia đình mình cần 1 lô hay nhiều lô liền kề để mình chọn đúng phương án?';
  }
  return '';
}
