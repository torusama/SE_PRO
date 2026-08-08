export const MEMORY_TYPES = [
  'user_preference',
  'business_rule',
  'faq',
  'information_correction',
  'recommendation_feedback',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const USER_MEMORY_KEYS = [
  'preferred_plot_location',
  'preferred_zone',
  'maximum_budget',
  'minimum_budget',
  'adjacent_plot_count',
  'preferred_direction',
  'accessibility_priority',
  'preferred_plot_type',
  'response_detail_preference',
  'service_interest',
  'consultation_topic_preference',
] as const;

export type UserMemoryKey = (typeof USER_MEMORY_KEYS)[number];

export interface MemoryProposal {
  category: string;
  title: string;
  content: string;
  memoryType: MemoryType;
  requestedScope: 'user' | 'global';
  memoryKey?: UserMemoryKey;
  reason: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  selectedOptionId?: string;
  rejectedOptionId?: string;
}

export type AutonomousLearningStatus =
  | 'saved_user_memory'
  | 'verified_and_activated'
  | 'stored_for_validation'
  | 'stored_as_learning_signal'
  | 'duplicate'
  | 'login_required'
  | 'rejected'
  | 'error';

export interface AutonomousLearningResult {
  status: AutonomousLearningStatus;
  message: string;
  knowledgeEntryId?: number;
  learningSignalId?: number;
}

export type AgentToolName =
  | 'search_available_plots'
  | 'find_adjacent_plot_groups'
  | 'rank_plot_options'
  | 'browse_available_plots'
  | 'get_service_suggestions'
  | 'estimate_total_cost'
  | 'suggest_bazi_direction'
  | 'get_purchase_process'
  | 'analyze_plot_competitiveness'
  | 'get_customer_care_overview'
  | 'create_draft_reservation'
  | 'propose_knowledge_update';

export interface AgentToolContext {
  conversationId: number | string | null;
  sessionId: string | null;
  sourceMessageId: number | string | null;
  userId: number | null;
  role: string | null;
}
