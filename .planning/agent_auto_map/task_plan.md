# Agent Auto Map Plan

## Goal
When the AI returns plot recommendations, automatically open a professional split chat/map experience, focus the recommended plots, and show their information without requiring a map-button click.

## Phases
- [complete] Inspect current chat response flow, map components, and responsive layout.
- [complete] Design state transitions for automatic map opening and recommendation focus.
- [complete] Implement split layout, map focus/zoom, plot detail presentation, and navigation between recommendations.
- [complete] Add or update tests for automatic behavior and manual controls.
- [complete] Run frontend validation/build and verify the interaction in the browser.

## Constraints
- Preserve the existing visual identity and colors.
- AI/backend plot IDs remain authoritative.
- Do not require a user click to reveal the map after a recommendation.
- Keep mobile behavior usable.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| `agent-browser` command is unavailable and the repo has no Playwright/Puppeteer package | 1 | Use the existing Vitest coverage plus HTTP/dev-server validation; avoid adding a large browser dependency only for this change. |
| New `AgentPage` tests failed because jsdom lacks `scrollIntoView` | 1 | Stub `Element.prototype.scrollIntoView` in the focused component test setup. |
| Second integration test found duplicate page elements from the previous render | 1 | Add explicit Testing Library cleanup after each test. |
