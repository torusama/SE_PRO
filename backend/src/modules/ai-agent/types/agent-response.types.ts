export type AgentPendingAction =
  | {
      kind: 'plot_request';
      stage: 'collecting' | 'awaiting_confirmation';
      plotIds: number[];
      plotCodes: string[];
      requestType?: 'reserve' | 'purchase';
      quotedTotal?: number;
      note?: string;
    }
  | {
      kind: 'service_order';
      stage: 'collecting' | 'awaiting_confirmation';
      serviceTypeId?: number;
      serviceName?: string;
      plotId?: number;
      plotCode?: string;
      requestedDate?: string;
      quotedPrice?: number;
      serviceUnit?: string;
      note?: string;
    }
  | {
      kind: 'appointment';
      stage: 'collecting' | 'awaiting_confirmation';
      appointmentDate?: string;
      startTime?: string;
      endTime?: string;
      topic?: string;
      note?: string;
      selectedPlotCode?: string;
    }
  | {
      kind: 'memorial_reminder';
      stage: 'collecting' | 'awaiting_confirmation';
      title?: string;
      description?: string;
      specificDate?: string;
      remindMonth?: number;
      remindDay?: number;
      isRecurring: boolean;
      calendarType: 'solar' | 'lunar';
      notifyDaysBefore: number;
      notifyEmails: string[];
    };

export type AgentUiDirective =
  | {
      /** Render the payment/confirmation card inside the chat, not in a side panel. */
      type: 'SHOW_INLINE_SERVICE_PAYMENT';
      serviceTypeId?: number;
      orderId?: number;
      amount?: number;
      paymentStatus?: 'unpaid' | 'awaiting_confirmation' | 'paid';
    }
  | {
      /** Open scheduling only after the payment step and highlight the known date. */
      type: 'OPEN_SERVICE_SCHEDULE_CALENDAR';
      orderId: number;
      requestedDate?: string;
      scheduledDate?: string;
    }
  | {
      type: 'OPEN_APPOINTMENT_CALENDAR';
      appointmentId?: number;
      appointmentDate?: string;
    }
  | {
      type: 'OPEN_REMINDER_CALENDAR';
      reminderId?: number;
      reminderDate?: string;
    };

export interface AgentRequirements {
  budgetMin?: number;
  budgetMax?: number;
  /** Number of alternative recommendation options the customer wants to see. */
  recommendationCount?: number;
  /** True when the customer explicitly asks for a comparison-led response. */
  comparisonRequested?: boolean;
  numberOfPlots?: number;
  preferredZone?: string;
  preferredDirection?: string;
  plotType?: 'single' | 'double' | 'family';
  minAreaSqm?: number;
  maxAreaSqm?: number;
  needAdjacent?: boolean;
  preferNearEntrance?: boolean;
  /** Session-local plots to omit when the customer asks for different options. */
  excludePlotIds?: number[];
  birthDate?: string;
  birthTime?: string;
  gender?: 'male' | 'female' | 'other';
  requestType?: 'reserve' | 'purchase';
  serviceQuery?: string;
  serviceTypeId?: number;
  selectedPlotCode?: string;
  requestedDate?: string;
  appointmentDate?: string;
  appointmentStartTime?: string;
  appointmentEndTime?: string;
  appointmentTopic?: string;
  reminderTitle?: string;
  reminderDescription?: string;
  reminderDate?: string;
  reminderRecurring?: boolean;
  reminderCalendarType?: 'solar' | 'lunar';
  reminderNotifyDaysBefore?: number;
  reminderNotifyEmails?: string[];
  note?: string;
  pendingAction?: AgentPendingAction;
}

export interface PlotCandidate {
  id: number;
  plotCode: string;
  zoneId: number;
  zoneName: string;
  price: number;
  status: string;
  direction: string | null;
  plotType: string;
  areaSqm: number | null;
  rowNumber: string | null;
  columnNumber: string | null;
  description: string | null;
  mapX: number | null;
  mapY: number | null;
  mapWidth: number | null;
  mapHeight: number | null;
  nearestEntrance: 'main' | 'secondary' | null;
  entranceProximity: 'near' | 'moderate' | 'far' | null;
  entranceDistanceMapUnits: number | null;
}

export interface RecommendationOption {
  optionId: string;
  plotIds: number[];
  plotCodes: string[];
  plots: PlotCandidate[];
  score: number;
  plotCost: number;
  serviceCost: number;
  estimatedTotal: number;
  currency: 'VND';
  zoneName: string;
  directions: string[];
  totalAreaSqm: number;
  isAdjacent: boolean;
  reasons: string[];
  tradeOffs: string[];
  analysisSummary: string;
  highlightPlotIds: number[];
  accessSummary: string | null;
  entranceDistanceMapUnits: number | null;
}

export interface BaziGoodDirection {
  direction: string;
  star: string;
  meaning: string;
}

export interface BaziBadDirection {
  direction: string;
  star: string;
  meaning: string;
}

export interface BaziSuggestion {
  preferredDirections: string[];
  alternativeDirections: string[];
  explanation: string;
  disclaimer: string;
  heavenlyStem: string;
  earthlyBranch: string;
  yearPillar: string;
  element: string;
  napAmElement: string;
  napAmName: string;
  napAmMeaning: string;
  cungMenh: string;
  tuMenh: string;
  birthHourBranch?: string;
  goodDirections: BaziGoodDirection[];
  badDirections: BaziBadDirection[];
  elementRelations: {
    supporting: string;
    weakening: string;
  };
  detailedAnalysis: string;
}

export interface RecommendationResult {
  requirements: AgentRequirements;
  recommendations: RecommendationOption[];
  suggestedServices: Array<{
    id: number;
    name: string;
    description: string | null;
    basePrice: number;
    unit: string;
    category: string;
  }>;
  baziSuggestion?: BaziSuggestion;
  inventoryPriceContext?: {
    candidateCount: number;
    minimumListedPrice: number;
    medianListedPrice: number;
    maximumListedPrice: number;
    scope: 'matching_available_inventory';
  };
  suggestedFollowUps?: Array<{ category: string; text: string }>;
  rankerVersion: string;
  fallbackUsed: boolean;
  rankerFallbackReason?: string;
  recommendationRunId?: string;
}

export interface RecommendationExecutionContext {
  userId: number | null;
  conversationId: number | string | null;
  sourceMessageId: number | string | null;
}
