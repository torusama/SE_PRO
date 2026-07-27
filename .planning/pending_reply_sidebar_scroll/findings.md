# Findings

- Screenshot shows an active plot request already has selected plot `C-02-001`, but “gửi yêu cầu” does not set `requestType=purchase`.
- Resulting pending action remains incomplete and repeats the generic missing-information message.
- Conversation history in the left sidebar needs an independent vertical overflow container.
- `AgentBookingService` routes any existing pending action into the booking flow. If the planner emits `confirm_pending_action` while the request is still `collecting`, `confirm()` returns the generic missing-information message.
- `preparePlotRequest()` already merges `plan.requirements.requestType` into the existing pending action, so normalize short replies before the booking service runs.
- `.agent-history` already declares vertical overflow, but `.agent-sidebar` does not lock its height/overflow and the scrollbar has no stable gutter or visible track.
