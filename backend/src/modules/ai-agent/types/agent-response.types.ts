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
    };

export interface AgentRequirements {
  budgetMin?: number;
  budgetMax?: number;
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
