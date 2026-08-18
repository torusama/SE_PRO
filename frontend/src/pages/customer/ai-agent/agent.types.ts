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
  analysisSummary?: string;
  accessSummary?: string | null;
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

export interface ComparisonFollowUpAction {
  id: "analyze_selected_plots" | "find_other_plots";
  label: string;
  message: string;
}

export interface AgentResponse {
  sessionId: string;
  messageId: number | null;
  assistantMessage: string;
  intent: string;
  requirements: Record<string, unknown>;
  recommendations: AgentRecommendation[];
  suggestedServices: AgentService[];
  suggestedFollowUps?: Array<{ category: string; text: string }>;
  quickReplies?: Array<{
    id: string;
    label: string;
    message: string;
    emphasis?: "normal" | "strong";
  }>;
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
  uiDirective?:
    | {
        type: "SHOW_INLINE_SERVICE_PAYMENT";
        serviceTypeId?: number;
        orderId?: number;
        orderIds?: number[];
        amount?: number;
        paymentStatus?: "unpaid" | "awaiting_confirmation" | "paid";
      }
    | {
        /** Read-only calendar shown only after admin confirms payment. */
        type: "OPEN_SERVICE_SCHEDULE_CALENDAR";
        orderId: number;
        orderIds?: number[];
        requestedDate?: string;
        scheduledDate?: string;
      }
    | {
        type: "OPEN_APPOINTMENT_CALENDAR";
        mode?: "collecting" | "review" | "summary";
        appointmentId?: number;
        appointmentDate?: string;
        startTime?: string;
        endTime?: string;
        topic?: string;
        plotCode?: string;
      }
    | {
        type: "OPEN_REMINDER_CALENDAR";
        reminderId?: number;
        reminderDate?: string;
      };
  metadata: {
    llmModel: string;
    rankerVersion: string;
    knowledgeVersion: string;
    fallbackUsed: boolean;
    fallbackReason?: string;
    rankerFallbackReason?: string;
    recommendationRunId?: string;
    traceId: string;
    learningResults?: Array<{
      status: string;
      knowledgeEntryId?: number;
      learningSignalId?: number;
    }>;
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
