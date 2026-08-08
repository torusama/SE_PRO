/**
 * Authoritative temporary hold policy used by the reservation workflow.
 * Keep operational facts in one shared place so the AI concierge and the
 * reservation service cannot drift apart.
 */
export const PLOT_PENDING_HOLD_MINUTES = 30;
