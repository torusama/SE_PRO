# Audit and expand AI Agent capabilities

## Goal
Audit every customer-facing advisory path, repair weak or shallow capabilities, and add grounded utilities that make the Agent useful beyond plot/service ordering—prioritizing plot competitiveness analysis and customer aftercare context that can be computed from real system data.

## Phases
- [completed] Inventory current planner actions, tools, data sources, customer workflows, and quality safeguards.
- [completed] Score each advisory area for completeness, grounding, follow-through, and missing customer value.
- [completed] Select the highest-value capabilities that can be implemented safely from existing authoritative data.
- [completed] Implement capability, dialogue, response, and frontend support without breaking existing routes or pending-action flows.
- [completed] Add regression tests for every new/changed capability and permission boundary.
- [completed] Run AI/backend/frontend builds, tests, lint, diff audit, and live server checks.

## Constraints
- Never fabricate demand, scarcity, market price, investment return, legal status, availability, competition, or proximity.
- “Competitiveness” must be defined transparently from internal inventory and real request activity; it is not an external market appraisal.
- Read-only analysis can be proactive. Any write action still requires authentication, an explicit customer choice, and final confirmation.
- Reuse existing modules/services and preserve current API envelopes, learning journal, conversation memory, and authorization.
- Keep the conversation progressive: answer first, explain practical implications, then ask exactly one useful next question.
- Preserve unrelated dirty-worktree changes.

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| context-mode skill was required for the broad audit, but no `ctx_*` runtime tools are registered | 1 | Use bounded local searches and short file slices, recording findings every two inspections. |
| A combined migration search returned exit code 1 because legacy table patterns were not present in that migration section | 1 | Verified scheduling against the runtime service and base domain schema instead. |
