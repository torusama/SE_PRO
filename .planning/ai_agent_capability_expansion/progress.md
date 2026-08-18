# Progress

- 2026-07-29: Started end-to-end AI capability audit and expansion plan.
# Progress

- Created persistent audit/implementation plan.
- Inventoried the current Agent tool surface and the main customer workflow tables.
- Identified two high-value, data-backed additions: plot competitiveness analysis and customer care overview.
- Confirmed the strict tool-schema/allowlist/context architecture and selected a dedicated insights service as the implementation boundary.
- Verified exact plot/request/order/appointment/ownership/reminder statuses in the database schema.
- Located all closed planner/tool routing points that must be updated for new conversational actions.
- Completed the first advisory quality scorecard; prioritized evidence gaps over cosmetic prompt additions.
- Confirmed new insights will inherit tool-call logging, output redaction, and the existing consultative response contract.
- Resolved the active scheduling schema and trusted user scoping for upcoming appointments.
- Audited the reminder read path and identified existing next-occurrence logic for reuse or exact parity.
- Chose to reuse `RemindersService.my` for reminder projection and query the remaining lifecycle summaries inside the new read-only insights service.
- Finalized a transparent internal competitiveness methodology and exclusion rules.
- Confirmed the new actions fit the existing response envelope and only require internal planner/registry/orchestrator additions.
- Added the read-only `AgentInsightsService` with internal plot-pressure analysis and authenticated customer-care aggregation.
- Reused the existing reminder next-date logic by exporting/importing `RemindersService`.
- Registered both capabilities in the strict tool schemas, tool-name union, allowlist, and planner intent/action enums.
- Added planner routing/clarification rules and action arguments for plot competitiveness and authenticated customer care.
- Added composer safeguards against fabricated urgency/market claims and cross-user data leakage.
- Added deterministic Vietnamese fallbacks for both new read-only actions, including transparent competition evidence, account summaries, and one concrete follow-up question.
- Added registry tests for plot-code validation and trusted user scoping.
- Added insights-service tests for scoring, non-actionable plots, not-found behavior, login boundaries, and per-query user isolation.
- Added icon-free welcome prompts so customers can discover plot competitiveness and full account-care summaries directly from the Agent page.
- Targeted backend verification passed: 3 suites, 20 tests covering the new insights service, registry routes, and planner actions.
- Backend Nest build passed.
- Frontend Vite build passed; only the repository's existing large-chunk/plugin-timing warnings were emitted.
- First targeted lint run found 31 mechanical Prettier/line-ending issues and 5 unsafe unknown-to-string conversions; no domain logic or query error. Fixing with scoped formatting plus explicit primitive conversion.
- Second targeted lint run reduced the result to one Prettier line-wrap issue in the orchestrator fallback; corrected manually.
- Targeted ESLint now passes for every changed backend TypeScript file and the customer Agent page.
- Full AI backend suite passed: 22 suites, 125 tests.
- Full frontend suite passed: 14 files, 47 tests.
- Scoped `git diff --check` passed. Diff-stat warnings only report the repository's LF-to-CRLF checkout policy; no whitespace error was found.
- Restarted both development servers successfully: backend listening on port 5000 and frontend Vite on port 5173.
- Confirmed the live route is `POST /api/ai-agent/chat` with optional authentication and a minimal `{ message }` body; frontend/backend smoke checks can use the running processes without changing APIs.
- Frontend live smoke returned HTTP 200 and the backend protected conversation route returned the expected 401 without a token.
- The first live chat probe returned success, but the smoke script inspected a nonexistent `data.message` field; the actual envelope uses `data.assistantMessage`. Correcting the assertion rather than treating this as a product failure.
- A corrected live chat probe exposed a real resilience gap: external planner failure returned only the generic outage message. Added deterministic fallback routing for explicit competitiveness and customer-care requests, reusing the same logged tool execution path.
- Added fallback tests for plot-code normalization, Vietnamese/English intent recognition, customer lifecycle intent, and false-positive avoidance.
- Resilience additions pass targeted ESLint and 4 targeted suites / 28 tests.
- Live competitiveness chat now succeeds even with planner fallback: intent `plot_competitiveness`, normalized code `A-01-001`, and a 579-character evidence-based response using real inventory/request data.
- Live anonymous customer-care chat returns intent `customer_care` and correctly requests sign-in without exposing account data.
- Final AI backend regression passed after fallback work: 23 suites, 133 tests.
- Final backend Nest build passed after fallback work.
- Final scoped diff check passed; both servers remain listening and frontend HTTP returns 200.
- Capability expansion complete. Final verification: backend AI 23 suites / 133 tests, frontend 14 files / 47 tests, backend and frontend builds passed, targeted backend/frontend ESLint passed, and both new actions passed live chat probes.

## Errors / recoveries

- A combined migration search returned exit code 1 because the requested legacy table patterns were not declared in that migration section; the scheduling schema slice was still returned and verified. Continued with authoritative service queries and the base schema.
- A repository-root `rg` used backend-relative paths and returned “path not found.” Re-ran it with `backend/` prefixes and found the registry tests/call sites.
- The first combined source patch did not apply because an encoding-corrupted inline comment in `reminders.module.ts` did not match byte-for-byte. Verified that no partial file was created, then split the change into encoding-safe patches with smaller contexts.
- A combined orchestrator patch hit the same legacy mojibake mismatch around a Vietnamese fallback string. No partial hunk was applied; split prompt, validation, switch, and fallback edits around ASCII-only anchors.
- On resume, the first fallback-response patch again used a mojibake line as context and was rejected without partial changes. Switched to action-name and method-signature anchors only.
- Appending planner tests to the legacy mojibake spec failed because the Vietnamese tail context did not match. Added a focused ASCII-safe `agent-planner.insights.spec.ts` instead.
- The first PowerShell listener-inspection command piped directly after a `foreach` block and hit an empty-pipe parser error. Rewriting it to collect rows before formatting.
- A route-discovery `rg` command used nested single quotes inside a PowerShell double-quoted regex and failed parsing. Avoiding the fragile regex and reading the small controller/main route declarations directly.
- The first rule-based fallback patch again included a mojibake assistant string and was rejected atomically. Reapplied the same logic using only ASCII method/field anchors.

## Worktree safety

- The repository already contains extensive user changes across backend, frontend, ML, migrations, and prior planning folders. Only files required for this Agent capability task will be touched; deleted/renamed migration work and unrelated UI changes are being preserved.
- Context-mode runtime tools were unavailable in this session; continuing with bounded local searches.
