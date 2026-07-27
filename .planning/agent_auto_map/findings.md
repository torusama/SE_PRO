# Findings

- `AgentPage` already stores recommendation payloads and owns `tourOpen` / `tourRecommendations`.
- The map tour currently opens only through `startGuidedTour`, which is passed to individual `AgentMessage` components as a click handler.
- `GuidedPlotTour` already provides the desired desktop composition: narrative/controls on the left and an interactive map on the right.
- The tour already switches among recommended options, displays plot metadata, animates steps, and exposes full-map/compare/draft actions.
- The safest implementation path is to make this existing data-driven tour open automatically after a successful AI response, then refine its presentation/state behavior rather than create a second map system.
- `GuidedTourMap` fetches `/plots/map`, maps backend plot IDs to SVG coordinates, highlights the active IDs, and animates the camera to their bounding box.
- The map already supports zoom, pan, rotation, overview reset, reduced-motion handling, loading/error states, and stale-plot detection.
- Because the response recommendations already contain authoritative `plotIds`, no backend response change is required for auto-focus.
- `GuidedPlotTour.css` already delivers a polished 40/60 split on desktop and a map-first stacked layout on mobile.
- `AgentMessage` currently renders recommendation cards and a manual “Bắt đầu tour giới thiệu lô đất” button. After auto-open, this button should become a replay/reopen affordance rather than the primary path.
- Automatic opening can happen immediately after the successful `/ai-agent/chat` response is validated with `getTourableRecommendations`.
- `buildGuidedTourSteps` already generates an overview, a focus and detail step for every option, an optional comparison overview, and a summary. Playback begins automatically and advances after narration.
- Existing tests cover tour state, plot-ID validation, camera modes, navigation, and map URL generation. A new policy helper/test can explicitly lock in the auto-open rule.
- The frontend dev server is live on port 5173 (PID 6216) and responds with HTTP 200.
- Browser automation is not installed (`agent-browser`, Playwright, and Puppeteer are unavailable), so visual verification must rely on component logic, responsive CSS inspection, unit tests, build, and live HTTP/API checks unless a new dependency is introduced.
- Existing component tests use Testing Library/Vitest and already construct a complete `AgentResponse`; they can be updated to verify the replay label and a focused `AgentPage` test can mock the tour to assert automatic opening after the API response.
- Vite is serving the updated modules with both the auto-launch policy and replay label present.
