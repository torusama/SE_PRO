# Progress

## 2026-07-26

- Created a scoped cross-stack implementation plan.
- Located the malformed system prompt, thin final-response prompt, immediate map-opening handler, immediate plot-card selection, and SVG camera rotation.
- Confirmed the map rotation source and inspected message rendering, recommendation cards, types, fallback narration, and existing tests.
- Implemented prompt v4 and a richer grounded fallback response.
- Implemented paced fresh-message rendering, delayed recommendation cards, delayed contextual map opening, staged plot details, and north-up map orientation.
- Added a focused paced-message test and configured page tests to bypass animation under reduced motion.
- Frontend full suite passes (32 tests), focused reveal/map suite passes (7 tests), lint passes, and production build passes.
- Backend AI-agent suite passes (29 tests), focused lint passes, and build passes.
- Backend restarted on PID 17900; frontend Vite remains active on port 5173 with HMR.
- Live API smoke confirmed a rich grounded recommendation with three options.
- User verification exposed two follow-ups: vague “giới thiệu đi bé” browses too early, and multi-layer mojibake remains in assistant prose even though structured cards are clean.
- Reopened the plan to fix discovery behavior and text normalization.
- Located the browse-before-validation path and the split between Markdown sanitization and structured-card normalization.
- Added deterministic discovery gating plus prompt rules for vague versus explicitly delegated requests.
- Added backend planner regression tests for “giới thiệu đi bé” and “chọn đại/không cần hỏi”.
- Added migration 013 and applied it successfully; database zone labels are now clean.
- Added Markdown-compatible legacy encoding repair and a prose regression test.
- Backend AI suite passes (31 tests); frontend suite passes (33 tests); focused lint and both builds pass.
- Backend restarted on PID 12996; frontend remains active on PID 6216.
- Live exact-phrase verification passes: discovery question shown, zero recommendations/map payload, clean font.
- User screenshot exposed a desktop viewport regression: the composer was clipped by the bottom edge/taskbar, and the contextual map close action was not reliably visible.
- Fixed the agent route height contract with a single `100dvh` flex boundary, non-shrinking navbar, and shrink-safe nested containers.
- Added a panel-relative floating close button to the contextual map and covered its callback with a component test.
- Verified the result visually at 1920x900: the composer and disclaimer remain fully visible. Frontend tests pass 33/33, focused lint passes, and the production build succeeds.
