export type AgentPendingAction =
  | {
      kind: 'plot_request';
      stage: 'collecting' | 'awaiting_confirmation';
      plotIds: number[];
      plotCodes: string[];
      quotedTotal?: number;
      note?: string;
    }
  | {
      kind: 'service_order';
      stage: 'collecting' | 'awaiting_confirmation';
      /** Undefined/create is a new order; cancel targets an existing order. */
      operation?: 'create' | 'cancel';
      orderId?: number;
      orderStatus?: string;
      candidateOrderIds?: number[];
      serviceTypeId?: number;
      serviceName?: string;
      plotId?: number;
      plotCode?: string;
      requestedDate?: string;
      quotedPrice?: number;
      serviceUnit?: string;
      note?: string;
      /**
       * A structured queue used when the customer asks for several services in
       * one request. Only the active item is collected/reviewed at a time, and
       * no order is created until every item has an explicitly confirmed date.
       */
      serviceItems?: AgentPendingServiceItem[];
      activeServiceItemIndex?: number;
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
      /** Queue of explicitly selected approved plots for a multi-plot visit. */
      appointmentItems?: AgentPendingAppointmentItem[];
      activeAppointmentItemIndex?: number;
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

export interface AgentPendingServiceItem {
  serviceTypeId?: number;
  serviceName?: string;
  plotId?: number;
  plotCode?: string;
  requestedDate?: string;
  quotedPrice?: number;
  serviceUnit?: string;
  note?: string;
  confirmed?: boolean;
}

export interface AgentPendingAppointmentItem {
  plotCode: string;
  appointmentDate?: string;
  startTime?: string;
  endTime?: string;
  confirmed?: boolean;
}

export type AgentUiDirective =
  | {
      /** Legacy directive name retained for stored conversations; frontend opens the service checkout side panel. */
      type: 'SHOW_INLINE_SERVICE_PAYMENT';
      serviceTypeId?: number;
      orderId?: number;
      /** All order ids when one chat request created several service orders. */
      orderIds?: number[];
      amount?: number;
      paymentStatus?: 'unpaid' | 'awaiting_confirmation' | 'paid';
    }
  | {
      /** Open the read-only service calendar only after admin confirms payment. */
      type: 'OPEN_SERVICE_SCHEDULE_CALENDAR';
      orderId: number;
      orderIds?: number[];
      requestedDate?: string;
      scheduledDate?: string;
    }
  | {
      type: 'OPEN_APPOINTMENT_CALENDAR';
      /**
       * collecting: the side panel should collect/adjust date and time.
       * review: the appointment is complete but still waiting for explicit user confirmation.
       * summary: the appointment request has already been created.
       * Optional for backward compatibility with stored conversations.
       */
      mode?: 'collecting' | 'review' | 'summary';
      appointmentId?: number;
      appointmentDate?: string;
      startTime?: string;
      endTime?: string;
      topic?: string;
      /** Approved reservation plot explicitly selected by the customer. */
      plotCode?: string;
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
  /** Birth year can be enough for the current Bát Trạch/Mệnh Quái calculation. */
  birthYear?: number;
  birthTime?: string;
  gender?: 'male' | 'female' | 'other';
  /** Zodiac understood from natural language; narrative context, never a hard inventory filter. */
  zodiacSign?: string;
  /** Multi-turn consultation goal: finish Bát Tự guidance before inventory search. */
  consultationGoal?: 'bazi_then_plots';
  serviceQuery?: string;
  /** Service names requested together in one customer turn. */
  serviceQueries?: string[];
  serviceTypeId?: number;
  serviceOrderId?: number;
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
  zoneCode: string;
  zoneName: string;
  zoneDescription: string | null;
  price: number;
  status: string;
  direction: string | null;
  plotType: string;
  areaSqm: number | null;
  rowNumber: string | null;
  columnNumber: string | null;
  description: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
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
  methodology?: {
    primaryFramework: string;
    secondaryFramework: string;
    scope: string;
  };
  applicationPrinciples?: string[];
  limitations?: string[];
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
