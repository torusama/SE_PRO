export type AgentToolName =
  | 'search_available_plots'
  | 'find_adjacent_plot_groups'
  | 'rank_plot_options'
  | 'browse_available_plots'
  | 'get_service_suggestions'
  | 'estimate_total_cost'
  | 'suggest_bazi_direction'
  | 'get_purchase_process'
  | 'create_draft_reservation'
  | 'propose_knowledge_update';

export interface AgentToolContext {
  conversationId?: number | null;
  sessionId?: string | null;
  messageId?: number | null;
  userId?: number | null;
  role?: string | null;
}
