# Findings

- Initial product intent: replace opaque draft creation with an Agent-led request flow.
- Plot flow: reuse known customer data, ask only missing request-specific details, summarize, confirm, then persist.
- Service flow: determine the service and eligible customer plot, ask missing scheduling/details, summarize, confirm, then persist.
- Map auto-open must be limited to plot recommendation/comparison presentation.
- The current recommendation-card action calls `POST /ai-agent/create-draft-reservation` after a browser `confirm()`. It creates an AI draft and appends a synthetic assistant message; it is not conversational.
- Normal reservation creation already exists at `POST /reservations` with `{ type: 'reserve' | 'purchase', plotIds, note? }`. The service creates `reservation_requests` and `request_plots`, and non-draft creation temporarily marks selected plots pending.
- The current Agent planner supports recommendations, service suggestions, purchase-process questions, Bazi guidance, and general questions; it has no booking intents/actions or pending confirmation contract.
- Agent conversation/message tables already persist extracted JSON metadata, providing a place to keep a pending action without adding a parallel client-only state machine.
- The frontend contextual map is controlled by local `mapOpen`/`mapRecommendations`; explicit card focus calls `setMapOpen(true)`. The response presentation path must be inspected further to narrow automatic opening.
- Service-order DTO currently exposes `serviceTypeId`, optional `plotId`, and optional `requestedDate`; exact controller/service behavior still needs a clean read because one batch shell command failed before returning those files.
- `POST /service-orders` currently inserts immediately, not as a draft, and notifies admins. Its service validates the service type but does not validate `plotId` ownership.
- Canonical active ownership can be resolved through `ownership_records` joined to active, non-deleted contracts and plots, with `o.user_id = authenticatedUserId` and `o.is_current = TRUE`. The newer `usage_right_records` table mirrors these rights, but legacy ownership is still the established application query path.
- Known profile data available from the authenticated account includes full name, email, phone, address, date of birth, and gender; booking tools should use `userId` and should never ask for fields that are already populated unless a transaction specifically requires verification.
- The Agent response currently generates `VIEW_ON_MAP` and `CREATE_DRAFT_RESERVATION` actions for every recommendation. This should become a conversational `START_PLOT_REQUEST` action.
- Automatic map opening happens only after an animated assistant message finishes and its response contains tourable recommendations. A follow-up response with no new recommendations intentionally keeps the existing map open; this is the behavior the user now finds intrusive, so non-plot intents should explicitly close it.
- `ChatDto` is a safe place to add an optional structured `clientAction` context for card clicks. This preserves the visible natural-language chat while passing selected plot IDs deterministically to the Agent.
- Proposed state contract: persist `pendingAction` inside the most recent assistant message `extracted_data`. Every booking turn writes the updated state; completion/cancellation writes no pending state, so an old request cannot be accidentally resurrected.
- Proposed plot flow: selected recommendation → choose `reserve` or `purchase` if missing → show authoritative summary → explicit confirmation → call `ReservationsService.create`.
- Proposed service flow: resolve service from authoritative service types → resolve active plots owned by the authenticated user → ask for plot only when ambiguous → ask for requested date if missing → summary → explicit confirmation → call `CemeteryServicesService.createOrder`.
- The planner remains the natural-language brain and emits structured booking actions/fields; backend code owns identity, ownership, availability validation, missing-field rules, confirmation gates, and persistence.
- No new database table is necessary because assistant message `extracted_data` and response metadata are already persisted and restored.
- Final persistence targets: confirmed plot requests are real rows in `reservation_requests` plus `request_plots`; confirmed service bookings are real rows in `service_orders`. The conversational pending action lives only in the latest AI message `extracted_data` until confirmation.
- Direct service-order creation now checks active ownership before inserting, so both manual and Agent flows reject another customer's plot.
- The UI no longer contains the legacy “Tạo yêu cầu nháp”, `onCreateDraft`, or `CREATE_DRAFT_RESERVATION` labels/actions.
- Live smoke: `GET /api/service-types` returned 200 with 8 active services; a guest `START_PLOT_REQUEST` chat returned 201, intent `plot_request`, a session ID, and the expected login guidance.
- Final verification: backend 80/80 tests, frontend 34/34 tests, both production builds pass, focused ESLint passes, and `git diff --check` reports no whitespace errors (only existing Windows line-ending notices).
- Runtime: backend listens on port 5000 as PID 10012 and frontend Vite listens on port 5173 as PID 6216.

## Errors

- The batched service-source command used a shell `for` loop that conflicted with context-mode's injected `NODE_OPTIONS` prefix. Next read will use explicit file paths instead of repeating the loop.
