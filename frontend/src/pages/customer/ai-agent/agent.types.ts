export type FeedbackType =
  | "helpful"
  | "bad_recommendation"
  | "wrong_information"
  | "irrelevant_answer"
  | "other";

export interface AgentRecommendation {
  optionId: string;
  plotIds: number[];
  plotCodes: string[];
  score: number;
  plotCost: number;
  serviceCost: number;
  estimatedTotal: number;
  currency: "VND";
  zoneName: string;
  directions: string[];
  totalAreaSqm: number;
  isAdjacent: boolean;
  reasons: string[];
  tradeOffs: string[];
  highlightPlotIds: number[];
}

export interface AgentService {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  category: string;
}

export interface AgentResponse {
  sessionId: string;
  messageId: number | null;
  assistantMessage: string;
  intent: string;
  requirements: Record<string, unknown>;
  recommendations: AgentRecommendation[];
  suggestedServices: AgentService[];
  baziSuggestion?: {
    preferredDirections: string[];
    alternativeDirections: string[];
    explanation: string;
    disclaimer: string;
    heavenlyStem?: string;
    earthlyBranch?: string;
    yearPillar?: string;
    element?: string;
    napAmElement?: string;
    napAmName?: string;
    napAmMeaning?: string;
    cungMenh?: string;
    tuMenh?: string;
    birthHourBranch?: string;
    goodDirections?: Array<{
      direction: string;
      star: string;
      meaning: string;
    }>;
    badDirections?: Array<{
      direction: string;
      star: string;
      meaning: string;
    }>;
    elementRelations?: {
      supporting: string;
      weakening: string;
    };
    detailedAnalysis?: string;
  };
  actions: Array<{
    type: string;
    optionId?: string;
    plotIds?: number[];
    serviceTypeId?: number;
    requiresAuthentication?: boolean;
    requiresConfirmation?: boolean;
  }>;
  metadata: {
    llmModel: string;
    rankerVersion: string;
    knowledgeVersion: string;
    fallbackUsed: boolean;
    fallbackReason?: string;
    traceId: string;
  };
}

export interface ChatMessage {
  localId: string;
  messageId?: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  responseTimeMs?: number;
  response?: AgentResponse;
  animatePresentation?: boolean;
}

export interface ConversationSummary {
  sessionId: string;
  title: string;
  preview: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    messageId: number;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
    response?: AgentResponse;
  }>;
}

export interface ProactiveConciergeDelivery {
  delivered: boolean;
  created?: boolean;
  resumeConversation?: boolean;
  sessionId?: string;
  reason?: string;
  response?: AgentResponse;
}
