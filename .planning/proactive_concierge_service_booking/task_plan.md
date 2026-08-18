# Proactive concierge and service booking

## Goal

Make the AI concierge initiate useful, context-aware messages without waiting for a user prompt, and make service booking complete real orders through the existing service APIs and user-owned plot data.

## Phases

1. [completed] Audit conversation loading, owned-plot/service APIs, and the current Agent service-booking state machine.
2. [completed] Design and implement deduplicated proactive next-best-action messages.
3. [completed] Repair and complete service booking against existing domain services/APIs.
4. [completed] Add regression tests and verify backend/frontend builds.
5. [completed] Restart servers and smoke-test proactive and service flows.

## Product constraints

- Proactive messages must be grounded in the current account, pending action, owned plots, and live service catalog.
- Do not insert a new assistant message on every refresh; deduplicate and apply a cooldown/event key.
- Never create a reservation or service order without an explicit final user confirmation.
- Reuse existing domain services/APIs rather than duplicating booking SQL or business rules.
- Preserve unrelated dirty-worktree changes.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Backend declaration build could not name an inferred private service type | 1 | Added an explicit controller response type; backend build passed. |
| Frontend React `useRef` required an initial value | 1 | Initialized the proactive request ref with `undefined`; frontend build passed. |
