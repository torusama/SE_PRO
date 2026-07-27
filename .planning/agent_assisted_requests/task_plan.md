# Agent-assisted plot and service requests

## Goal
Turn the current “Tạo yêu cầu nháp” action into a real conversational Agent workflow that reuses known account data, asks only for missing information, confirms the request, and creates the corresponding database record. Apply the same behavior to cemetery-service booking, and only auto-open the contextual map when plot recommendations/comparisons are actually being presented.

## Phases
- [completed] Audit current Agent tools, reservation/service APIs, user profile data, database models, and frontend map-trigger logic.
- [completed] Design the minimal conversational state and safe confirmation contract for plot requests and service bookings.
- [completed] Implement backend Agent tools and orchestration for collecting missing fields, resolving owned plots, confirming, and creating records.
- [completed] Update frontend labels/actions and restrict contextual-map auto-open behavior to plot recommendation/comparison responses.
- [completed] Add focused backend/frontend tests for known-data reuse, missing-data questions, confirmation, creation, no-owned-plot behavior, and map visibility.
- [completed] Run lint/tests/build, smoke-test the live flow, and document final behavior.

## Decisions
- The Agent must never create a reservation or service booking before explicit user confirmation.
- Existing trusted account/profile/ownership data is reused and must not be asked again.
- Ambiguous owned-plot selection must be resolved conversationally.
- A customer with no eligible/owned plot receives an explanation and a relevant consultation path instead of a broken booking flow.
- The contextual map is a plot-consultation surface, not a global companion for every chat.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Initial combined type patch expected planner types in `agent-response.types.ts` | 1 | Read the two small edit targets directly and split the patch between response requirements and planner definitions. |
| TypeScript did not retain `userId` narrowing when passing the original input object to private booking handlers | 1 | Created a narrowed `authenticatedInput` after the unauthenticated early return. |
| The first batched “frontend build” inherited the backend working directory | 1 | Treat that result as a duplicate backend build and rerun frontend from its own directory. |
| Focused Vitest command used paths prefixed with `frontend/` while already running inside that directory | 1 | Rerun with `src/pages/...` paths. |
| Focused backend lint found one unused import plus Prettier/CRLF formatting differences | 1 | Removed the unused import and ran Prettier only on the touched backend files. |
| Listener inspection through context-mode expanded PowerShell `$variables` in its shell wrapper | 1 | Switched the guaranteed-small listener check to the native PowerShell tool. |
| Existing `start:dev` watcher process did not finish recompiling or bind port 5000 | 1 | Stopped only the exact watcher process tree, rebuilt cleanly, and launched `dist/main.js` through context-mode background execution. |
| Two hidden production-start checks timed out without a listener or useful redirected output | 2 | Ran the built server in the foreground/background-aware runner, which exposed clean Nest startup logs and kept PID 10012 alive. |
