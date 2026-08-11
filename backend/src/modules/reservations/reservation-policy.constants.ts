/**
 * Authoritative temporary lock policy used by the purchase-request workflow.
 * Keep operational facts in one shared place so the AI concierge and the
 * reservation service cannot drift apart.
 */
export const PLOT_PENDING_LOCK_MINUTES = 30;
