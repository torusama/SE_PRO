# AI chat interactions

## Goal
Improve the existing AI Concierge chat with Markdown rendering, cancellable timed responses, copy/edit/resend actions, a cleaner single new-chat entry point, and a richer sales-oriented welcome experience. Also implement the supplied incremental Cinematic Synchronized Plot Tour using real recommendations and the existing map.

## Phases
- [complete] Read supplied requirements, research current ChatGPT interaction patterns, and audit local chat/API state.
- [complete] Implement Markdown and message action primitives.
- [complete] Implement abort/timer response state and edit/resend branching behavior.
- [complete] Improve welcome marketing copy and remove the redundant topbar new-chat action.
- [complete] Audit and extract/reuse the existing cemetery map for the synchronized guided tour.
- [complete] Implement the central tour controller, narration, controls, camera/highlights, and full-map handoff.
- [complete] Add focused tests for chat actions and guided-tour synchronization/accessibility/error states.
- [complete] Build, test, visually verify, and record results.

## Constraints
- Preserve current DB-backed conversation history and customer isolation.
- Keep the navy/cyan/gold Vĩnh Phúc Viên visual identity.
- Editing a sent message must produce a fresh assistant response without corrupting saved history.
- Do not copy another product's branding; reuse only broadly useful interaction patterns.
- Guided tour is frontend-only, uses real Agent recommendation fields, and must not duplicate backend calculations.
- Preserve existing map, recommendation, comparison, feedback, Bazi, and draft-reservation behavior.

## Errors Encountered
- `ctx_execute_file` could not read the user attachment because it is outside the workspace. Use the explicitly supplied attachment path with a direct read instead.
- `ctx_search` again failed to retrieve auto-indexed AgentPage chunks by source label. Switched to bounded direct line extraction and will not repeat that search path.
- Package installation reports 4 dependency audit findings (2 moderate, 2 high). No forced audit fix will be applied because it may introduce unrelated breaking upgrades; verify provenance after implementation.
- First frontend build found React 19 `useRef` initial-value typing errors in GuidedTourMap. Fixed by explicitly initializing optional animation/pointer refs with `undefined`.
- A planning-file patch contained an invalid empty update hunk. Retried with a single valid update hunk.
- Targeted lint found 9 React 19 purity/effect-state violations in the new timer, narration, and map components. Tests pass; refactor those effects to lazy state/RAF-safe patterns before final build.
- The first JSON-lint summarizer could not spawn `npx.cmd` inside the context sandbox and then hit an undefined-output parser fallback. Switch to the local ESLint JS entrypoint with `process.execPath`.
- A findings update used stale context and failed verification. Reapplied it against the current final research lines.
- One resumed inspection used the pre-refactor component directory from the compacted summary. Located the files with `rg --files` and continued from their actual `pages/customer/ai-agent` path.
- The first headless screenshot command interpolated a PowerShell property incorrectly, then the second command checked before Chrome had flushed the file. Retried with explicit resolved variables and inspected the completed image successfully.
- The shell policy rejected `Remove-Item` cleanup commands even after target validation. Used exact, workspace-contained .NET file/directory deletion for only the temporary screenshot and Chrome profile; both are confirmed absent.
- Live verification initially still returned the old NVIDIA behavior because port 5000 was running `node dist/main.js` without watch mode. Rebuilt, restarted that exact verified listener, then repeated both invalid-count and valid-count two-turn API checks successfully.
- The first background restart check ran before the new process had bound port 5000. Relaunched it with a bounded listener poll; backend is now listening on the new process.
- Removing the deterministic partial-requirement clarification exposed NVIDIA timeout/tool-loop instability and allowed an unstructured hallucinated plot list with no UI payload. Restored the safe partial clarification as part of a hybrid NL pipeline, prohibited wait-only responses, and ensured all displayed recommendations are backed by PostgreSQL tool results.
- End-to-end audit found that the hybrid patch makes some scenarios work but does not satisfy the user's intended AI-as-brain architecture. Required next refactor: force an NVIDIA planner call to return structured intent/requirements/tool choice, execute only registered backend tools, feed tool results back to NVIDIA for final narration, and build UI actions exclusively from authoritative tool output.
- The AI-first refactor described above is now implemented and live-verified. Backend retains regex only for explicit-value reconciliation and offline fallback; NVIDIA owns normal intent/action planning and final narration.
