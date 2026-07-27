import { BadRequestException } from '@nestjs/common';
import { AgentRequirements } from './types/agent-response.types';

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
            'confirm_pending_action',
            'cancel_pending_action',
            'get_purchase_process',
            'suggest_bazi_direction',
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
        budgetMin: { type: 'number', minimum: 0 },
        budgetMax: {
          type: 'number',
          minimum: 1,
          description:
            'The customer total maximum budget in VND. Treat colloquial "củ" as millions.',
        },
        numberOfPlots: { type: 'integer', minimum: 1 },
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
        birthDate: { type: 'string' },
        birthTime: { type: 'string' },
        gender: {
          type: 'string',
          enum: ['male', 'female', 'other'],
        },
        requestType: {
          type: 'string',
          enum: ['reserve', 'purchase'],
          description:
            'Whether the customer wants a temporary reservation or a purchase request.',
        },
        serviceQuery: {
          type: 'string',
          description:
            'The cemetery service name or natural-language description requested by the customer.',
        },
        serviceTypeId: { type: 'integer', minimum: 1 },
        selectedPlotCode: { type: 'string' },
        requestedDate: {
          type: 'string',
          description:
            'Requested service date in YYYY-MM-DD format. Resolve relative Vietnamese dates from the current date supplied by the system.',
        },
        note: { type: 'string', maxLength: 1000 },
      },
      required: [
        'intent',
        'action',
        'contextMode',
        'needsClarification',
        'clarificationQuestion',
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
  | 'general_question';

export type AgentPlanAction =
  | 'rank_plot_options'
  | 'browse_available_plots'
  | 'get_service_suggestions'
  | 'prepare_plot_request'
  | 'prepare_service_order'
  | 'confirm_pending_action'
  | 'cancel_pending_action'
  | 'get_purchase_process'
  | 'suggest_bazi_direction'
  | 'none';

export interface AgentPlan {
  intent: AgentPlanIntent;
  action: AgentPlanAction;
  contextMode: 'continue' | 'replace' | 'relax';
  needsClarification: boolean;
  clarificationQuestion: string;
  requirements: AgentRequirements;
}

const INTENTS = new Set<AgentPlanIntent>([
  'recommend_plots',
  'service_suggestions',
  'plot_request',
  'service_booking',
  'purchase_process',
  'bazi_suggestion',
  'general_question',
]);
const ACTIONS = new Set<AgentPlanAction>([
  'rank_plot_options',
  'browse_available_plots',
  'get_service_suggestions',
  'prepare_plot_request',
  'prepare_service_order',
  'confirm_pending_action',
  'cancel_pending_action',
  'get_purchase_process',
  'suggest_bazi_direction',
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
  const preferredZone = optionalString(parsed.preferredZone);
  const requirements: AgentRequirements = {
    budgetMin: optionalPositiveNumber(parsed.budgetMin),
    budgetMax: optionalPositiveNumber(parsed.budgetMax),
    numberOfPlots:
      numberOfPlots !== undefined && Number.isInteger(numberOfPlots)
        ? numberOfPlots
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
    birthDate: optionalString(parsed.birthDate),
    birthTime: optionalString(parsed.birthTime),
    gender:
      parsed.gender === 'male' ||
      parsed.gender === 'female' ||
      parsed.gender === 'other'
        ? parsed.gender
        : undefined,
    requestType:
      parsed.requestType === 'reserve' || parsed.requestType === 'purchase'
        ? parsed.requestType
        : undefined,
    serviceQuery: optionalString(parsed.serviceQuery),
    serviceTypeId:
      optionalPositiveNumber(parsed.serviceTypeId) !== undefined &&
      Number.isInteger(optionalPositiveNumber(parsed.serviceTypeId))
        ? optionalPositiveNumber(parsed.serviceTypeId)
        : undefined,
    selectedPlotCode: optionalString(parsed.selectedPlotCode),
    requestedDate: optionalString(parsed.requestedDate),
    note: optionalString(parsed.note),
  };
  if (
    requirements.budgetMin !== undefined &&
    requirements.budgetMin === requirements.budgetMax
  ) {
    delete requirements.budgetMin;
  }

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
    requirements: Object.fromEntries(
      Object.entries(requirements).filter(([, value]) => value !== undefined),
    ),
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
      ? 'Với nhu cầu dòng tộc/gia đình, bạn dự trù tổng ngân sách khoảng bao nhiêu và muốn một lô family chuyên dụng hay một nhóm bao nhiêu lô liền kề?'
      : 'Bạn muốn một lô family chuyên dụng hay một nhóm bao nhiêu lô liền kề cho gia đình/dòng tộc?';
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
