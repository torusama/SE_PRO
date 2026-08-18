# Findings

- The user wants a broad quality audit plus new utilities, specifically suggesting grounded “plot competitiveness” analysis.
- Context-mode instructions were loaded, but its runtime is unavailable; bounded local inspection is the fallback.
- The immediately prior change already strengthened recommendation depth, per-option trade-offs, and follow-up questions; this audit should build on that work rather than duplicate it.
# Audit findings

## Current Agent capability surface

- Plot discovery and comparison: `search_available_plots`, `browse_available_plots`, `find_adjacent_plot_groups`, `rank_plot_options`.
- Financial support: `estimate_total_cost`.
- Service discovery: `get_service_suggestions`.
- Bát tự / direction guidance: `suggest_bazi_direction`.
- Process guidance: `get_purchase_process`.
- Transaction preparation: plot request and service-order draft/confirmation flows.
- Knowledge governance: `propose_knowledge_update`.

## Important gaps

- No grounded plot-interest or inventory-pressure analysis. The Agent cannot currently explain whether a plot has competing internal requests or how many comparable available plots remain.
- No authenticated customer lifecycle overview covering active plot requests, service orders, reminders, appointments, contracts, or owned plots.
- Existing data sources can support those features without inventing external market demand:
  - `plots`
  - `reservation_requests` + `request_plots`
  - `contracts` + `ownership_records`
  - `service_orders`
  - `reminders`
  - appointment/schedule tables
- Any “competitiveness” label must be explicitly framed as an internal, point-in-time signal based on system inventory and request activity—not market valuation, guaranteed scarcity, or investment return.

## Candidate implementation

1. `analyze_plot_competitiveness`: read-only, plot-specific inventory comparison and real request activity with transparent signals/caveats.
2. `get_customer_care_overview`: authenticated, read-only summary of the customer’s current requests/orders/ownership and upcoming care events.
3. Fold request/order tracking into the care overview instead of adding several overlapping tools.

## Existing tool architecture

- Tool JSON schemas are centralized in `tools/agent-tools.definition.ts`.
- `AgentToolRegistryService` maintains a strict allowlist, validates untrusted arguments, and delegates domain work to services.
- Trusted identity is already passed as `AgentToolContext`; the care overview can require `context.userId` without accepting any caller-supplied user identifier.
- New domain queries should live in a dedicated injectable service so the registry remains a validator/router and the calculations can be unit tested directly.

## Confirmed schema semantics

- Plot states: `available`, `pending`, `reserved`, `sold`, `locked`.
- Reservation request states: `draft`, `submitted`, `pending`, `approved`, `rejected`, `cancelled`; request-to-plot links preserve the plot price at request time.
- Service order active workflow: `submitted`, `pending_confirm`, `confirmed`, `in_progress`, then `completed`/`cancelled`.
- Appointments use `scheduled`, `completed`, `cancelled`.
- Ownership has a trustworthy `is_current` flag.
- Reminders can be annual or one-time and have `is_active`/`is_deleted`, but annual reminders require date projection before “upcoming” can be stated.
- Internal plot pressure can safely count real linked requests by recency and status. Drafts must not be presented as competing demand; rejected/cancelled requests must be excluded.

## Planner integration

- `AgentToolName` is a closed union, so both additions require type, schema, allowlist, and execution cases.
- The customer-facing planner also uses a closed `AgentPlanAction` schema/allowlist and explicit prompt routing. Adding only a registry tool would leave the conversational Agent unable to select it reliably.
- The orchestrator has action-specific tool execution and response-grounding branches that must be extended, with regression tests for intent routing and authenticated context.

## Quality audit by advisory area

- Plot selection/comparison: strong after the prior enrichment work; grounded prices, trade-offs, access caveats, and progressive questioning are enforced.
- Bát tự/direction: reasonably deep and explicitly cultural/advisory, but it should remain separate from factual availability and must not be framed as deterministic.
- Services: authoritative list and prices exist, and the composer is told to explain fit/inputs/confirmation; no urgent structural gap.
- Purchase process: grounded/versioned, but informational only.
- Booking/request creation: protected confirmation flow is already the right safety model.
- Request/order status and owned-plot aftercare: weak. The composer prompt mentions this scope, but the planner has no read tool/action, so a model response could be generic or unsupported.
- Plot demand/competition: absent. Conversational follow-ups currently fall into `none`, so no current inventory/request evidence can be fetched.

## Orchestrator behavior

- Any non-`none` action is logged with trusted context, then its sanitized JSON becomes the only authoritative result the composer may use.
- The existing response contract is already suitable for the new insights: answer first, explain criteria/trade-offs/limits, recommend a next step, and end with one useful question.
- The module can register one additional provider directly; `DatabaseService` is globally available through the existing database module pattern.
- Fallback text must be added for both new tool results so the feature remains useful when the LLM composer is unavailable.

## Runtime data-source notes

- `DatabaseModule` is global, so the insights service can inject `DatabaseService` without widening module imports.
- The live scheduling module uses `schedule_appointments` from the consolidated migration, not the older `appointments` table shown near the top of `DBase.sql`.
- Customer appointments are keyed by `requester_id`/`host_user_id`; upcoming customer care should include requester-side `pending`/`confirmed` records with `appointment_date >= CURRENT_DATE`.
- `RemindersService.my(userId)` already computes and sorts the next occurrence for recurring and one-time reminders. Reusing that behavior is preferable to duplicating calendar edge cases if the module boundary permits it.
- `RemindersModule` does not currently export `RemindersService`; a small explicit export/import change is needed to reuse it in the Agent module.
- The reminder decorator correctly clamps invalid month-end dates, advances annual reminders to the next year, and removes expired one-time reminders from “upcoming”; this logic should remain the single source of truth.

## Competitiveness methodology decision

- Resolve a plot by authoritative `plot_code`, including its current status, zone, type, direction, area, and listed price.
- Compare it only with currently available, non-deleted plots of the same zone and plot type.
- Current competing interest = distinct linked requests in `submitted`/`pending`.
- Recent 30-day interest = distinct linked requests in `submitted`/`pending`/`approved`; drafts and failed/cancelled outcomes remain excluded.
- Explain the level from transparent components: current active interest, recent interest, and number of comparable available alternatives.
- Price position is an internal listing comparison only and must never be described as external market price, appreciation, or investment potential.

## Implementation impact

- `AgentRequirements` already carries `selectedPlotCode`, so competitiveness needs no new free-form requirement field.
- The registry unit tests construct the service directly; adding the insights dependency requires updating two constructors and adding explicit trusted-context assertions.
- The main chat flow already passes the raw tool output through fallback generation, composition, logging, and finish metadata. No controller/API envelope change is necessary.

## Frontend discoverability

- The customer Agent welcome state exposes four starter prompts, but none advertise the new lifecycle or plot-pressure utilities.
- Starter buttons still render decorative text icons even though the requested visual direction is icon-free. The new frontend support should add two plain-text prompts and remove the icon element from every starter card without changing chat APIs.
