# Progress

- 2026-07-26: User rejected the auto-playing guided tour and requested a continuous chat with a contextual right-side map.
- 2026-07-26: Inspected current chat/CSS and encoding symptoms; decided to remove tour usage and embed a static contextual map beside the normal chat stream.
- 2026-07-26: Designed state rules: new recommendations replace/focus the map, ordinary follow-up replies preserve current map context, historical conversations restore their latest recommendation context.
- 2026-07-26: Replaced automatic guided-tour usage with an inline `AgentContextMap` beside the existing chat.
- 2026-07-26: Removed the tour launch/replay control from chat messages; “Xem bản đồ” now focuses the inline panel.
- 2026-07-26: Added canonical zone reconstruction and encoding-safe VND/text rendering for recommendation UI.
- 2026-07-26: Updated component tests and added display-normalization tests.
- 2026-07-26: Added interaction coverage proving follow-up chat preserves map context and new agent recommendations update it.
- 2026-07-26: Removed the remaining active-chat tour-launch styling/reference.
- 2026-07-26: Final validation passed: 28/28 frontend tests, production build, and modified-file lint.
- 2026-07-26: Verified Vite HTTP 200 and confirmed the served `AgentPage` uses the inline contextual map with no tour overlay.
