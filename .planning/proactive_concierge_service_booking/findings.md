# Findings

- The current request explicitly asks for proactive assistant messages and an end-to-end audit of service booking.
- The preferred behavior is event/context driven rather than generic spam: resume pending work, suggest services for owned plots, or guide first-time users.
- Existing service booking already delegates final creation to `CemeteryServicesService.createOrder()` and validates that the selected plot belongs to the signed-in user.
- Gaps found: no proactive entry point, no service-price revalidation after the final summary, and no idempotency protection for duplicate service orders.
- Proactive delivery should reuse an unanswered proactive conversation, resume the full conversation when a pending action already has follow-up, and otherwise observe a 12-hour state-key cooldown.
