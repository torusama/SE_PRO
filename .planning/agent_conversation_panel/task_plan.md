# Collapsible AI conversation panel

## Goal
Turn the AI conversation sidebar into a closable overlay panel so the main AI chat content stays centered under the shared header when the panel is closed. Opening the panel overlays it above the chat; clicking outside closes it.

## Phases
- [completed] Locate the Agent page layout, sidebar state, and existing design tokens.
- [completed] Add accessible open/close behavior and outside-click dismissal without changing AI/backend behavior.
- [completed] Style the panel/trigger with existing Agent design language and make the main content center correctly when closed.
- [completed] Run focused tests/build/lint and visual smoke checks.

## Constraints
- Frontend only; preserve all conversation data and API behavior.
- No new icon dependency; reuse existing text/symbol treatment where appropriate.
- Panel overlays content only while open and dismisses on outside click or Escape.
- Keep keyboard focus and narrow-screen behavior usable.

## Errors

| Error | Attempt | Resolution |
|---|---:|---|
| context-mode runtime is unavailable | 1 | Use bounded code inspections and focused verification commands. |
| Headless Agent screenshot checked for a file before Chrome finished writing it | 1 | Image was written asynchronously afterward; do not retry the same command. Route guard then redirected the unauthenticated profile to Login, so rely on interaction test/build for this protected UI. |
