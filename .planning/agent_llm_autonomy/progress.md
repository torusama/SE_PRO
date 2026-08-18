# Progress

- 2026-07-28: Started tracing scope interception and canned response paths.
- 2026-07-28: Located deterministic scope/closing helpers and the rule-based proactive greeting service.
- 2026-07-28: Confirmed the scope block executes before the LLM and the fixed closing helper mutates every response; identified grounded inputs for LLM-generated proactive greetings.
- 2026-07-28: Removed the pre-LLM scope classifier and forced closing helper, deleted their tests, added semantic scope/greeting rules to prompt v8, and converted proactive greetings to multi-provider LLM generation with no canned message when providers are unavailable.
- 2026-07-28: Formatted Windows line endings. AI Agent test suite passes 71/71, focused ESLint passes, and backend build passes.
- 2026-07-28: Final proactive greeting tests passed 4/4; focused ESLint and backend build passed.
- 2026-07-28: Restarted the backend on port 5000. CORS preflight from `http://localhost:5173` returned 204, and the frontend remained available on port 5173.
- 2026-07-28: Live API smoke test for `5 lô 100 triệu` passed through the LLM and returned grounded recommendations instead of a scope refusal.
