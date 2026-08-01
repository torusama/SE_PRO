# Findings

- Screenshot evidence: the shared header renders the authenticated admin identity, while the Agent conversation sidebar renders its signed-out prompt in the same page. This strongly suggests two different auth-state checks rather than an expired global session.
- Root cause confirmed: `AgentPage` treats history as authenticated only when `role === "customer"`, and the three customer-facing conversation-history endpoints are also decorated with `@Roles('customer')`. The chat endpoint itself uses optional authentication and the orchestrator persists any authenticated `user.id`, including admins, so admin chat rows can be created but the admin cannot list/open/delete them.
- Booking and service-order actions are correctly customer-only and must remain unchanged; only conversation persistence/history should accept both customer and admin roles.
- Live authenticated verification now returns HTTP 200 for an admin calling `/api/ai-agent/conversations` (empty list is valid for the current admin account), proving the backend role mismatch is resolved.
