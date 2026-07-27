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
  mapX: number | null;
  mapY: number | null;
  mapWidth: number | null;
  mapHeight: number | null;
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
  highlightPlotIds: number[];
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
  rankerVersion: string;
  fallbackUsed: boolean;
}
