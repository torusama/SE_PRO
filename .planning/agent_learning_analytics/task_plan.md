# Application-level Learning Analytics dashboard

## Goal
Build a seminar-ready Admin AI Agent analytics tab that summarizes persistent memory, verified knowledge, recommendation learning signals, PlotRanker execution/fallback behavior, and recent learning updates without implying foundation-model retraining.

## Phases
- [completed] Audit existing admin API/page styling, database fields, and test patterns.
- [completed] Design and implement a trusted admin analytics API with bounded aggregate queries.
- [completed] Build the frontend analytics tab with KPI cards, accessible CSS charts, filters/legend, and recent-update table.
- [completed] Add backend and frontend tests for aggregates, empty states, and rendering.
- [completed] Run targeted lint, unit tests, builds, and final diff review.

## Constraints
- Preserve all existing user changes and the completed memory/knowledge/ranker architecture.
- Use existing React/CSS patterns and dependencies; do not add a charting package unless necessary.
- All metrics must come from stored application-level events, never from fabricated values.
- Keep trusted admin guards on the endpoint and bound query/result sizes.
- UI terminology must say application-level learning, not self-training of the foundation LLM.

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| `rg` received a Windows wildcard path for Vite config | 1 | The required test setup was already found; use concrete paths for any further config inspection. |
| Disposable PostgreSQL validation used one raw client for concurrent dashboard queries and emitted a pg deprecation warning | 1 | Queries completed successfully; production uses `Pool`, so no implementation change is required. |
