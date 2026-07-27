# Findings

## User request
- Render Markdown instead of displaying raw `**`.
- Show response elapsed time and allow stopping an in-flight response.
- Add copy for assistant text.
- Allow editing a sent user message and resending it to receive a fresh answer.
- Remove the redundant topbar “Chat mới”; sidebar already has “Cuộc trò chuyện mới”.
- Expand the short empty-state introduction into persuasive guidance/marketing copy.

## Supplied specification
- The attachment additionally requires a frontend-only “Cinematic Synchronized Plot Tour”.
- Tour opens inside AgentPage as a 40/60 conversation/map split, preserves the conversation, and uses the existing real map—not iframe/mock data.
- One central active-step state must synchronize narration, active recommendation, highlighted plot IDs, map camera, floating details, and progress.
- Required controls: play/pause, previous/next, restart, reveal text, exit, auto-advance toggle; keyboard Space/arrows/Escape.
- Map remains interactive; manual control pauses camera playback and exposes Resume.
- Mobile stacks map above narrative; reduced-motion disables long movement; invalid plots/map failures remain recoverable.
- Full-map navigation must carry active option/plot IDs and focus them on load.
- The attachment asks for tests covering 15 interaction/synchronization/error/accessibility cases.

## Local architecture
- Agent UI is concentrated in `AgentPage.tsx`, `AgentMessage.tsx`, `AgentPage.css`, `agent.types.ts`, recommendation/comparison/feedback components.
- Existing customer map is `pages/customer/map/MapPage.tsx`; shared visuals/constants already exist under `components/map` and `lib/map`.
- No Markdown renderer/sanitizer dependency and no frontend test framework are currently installed.
- AgentPage owns message/history/session state and a single request path; it is the correct place for AbortController, elapsed time, and edit/resend orchestration.
- Map route is the existing `/ban-do` constant and is already used by AgentPage's “view on map” action.
- `sendMessage` posts `{sessionId, message}` to `/ai-agent/chat`, appends the assistant response, then refreshes DB-backed conversations.
- Existing `viewOnMap` already forwards `highlightPlotIds` through the `highlight` query parameter, which the guided tour/full-map handoff should preserve.
- Current `loading` is a single boolean with no AbortController or elapsed timer; request errors are mapped to a user-facing alert.
- `newChat` fully resets the local session/messages and is already exposed in the sidebar, so removing only the topbar button is safe.
- Opening a persisted conversation maps DB `messageId`, role, content, response, and timestamp back into the same `ChatMessage` model.
- `AgentMessage` currently inserts content as plain text; this directly causes raw Markdown markers such as `**` to display.
- Message footer already has a suitable action area for copy/edit/feedback controls. User messages currently have no actions.
- `AgentRecommendation` provides all tour-facing business values (plot/highlight IDs and codes, score, costs, zone, direction, area, adjacency, reasons/tradeoffs); no frontend recalculation is needed.
- MapPage is a large 2,091-line component with inline zoom/rotation/pan/plot rendering. It already reads `highlight` query IDs, selects one/group, and exposes the existing full-map behavior needed for handoff.
- Safely reusing the entire MapPage inline is not viable; the next audit must isolate its map data/type/rendering primitives or build a shared canvas without duplicating business calculations.
- There are no pre-existing `components/map` or `lib/map` directories; MapPage currently owns all map UI.
- MapPage imports shared map layout constants/types from other repository locations, maintains `zoom`, `rotation`, selection and pointer-pan state, and renders the SVG plot groups inline under a transformed `<g>`.
- A new reusable guided-tour canvas can consume the same layout/types/API while leaving MapPage behavior untouched; this is lower risk than extracting hundreds of lines from a live 2,091-line page in the same change.
- Reusable map sources are `lib/cemeteryMapLayout` (coordinates/zones) and `lib/cemeteryMapVisuals` (viewBox, roads, boundaries, gates, backdrops).
- MapPage's backend plot shape is simple and the shared coordinate helper can map real API records directly into tour plots; the tour does not need placeholder plots or reservation state.
- This enables a lean interactive SVG canvas that genuinely reuses the existing map geometry/status data without duplicating recommendation calculations.
- Real map data comes from unauthenticated `GET ${API_BASE_URL}/plots/map`, already polled by MapPage every 30 seconds with AbortController cleanup.
- Shared visuals provide a complete `-100 -60 1780 1720` viewBox, boundary, roads, gates, spirit park, zone backdrops and cluster backdrops.
- Guided-tour canvas can load once per open session, render only real plots with status fills, and use active recommendation IDs as an additional glow layer.
- `cemeteryMapLayout` already exports `getCemeteryZoneCode` and `getCemeteryCoordinates`, removing the need to duplicate MapPage's zone/coordinate logic.
- RecommendationCard exposes the three existing business actions (map, compare, draft) through callbacks; the tour should accept and render the same callbacks rather than reimplement them.
- Vite config already defines the `@` alias; Vitest can be added to the same config with a jsdom environment and setup file.
- `react-markdown` 10.1 and `remark-gfm` 4 are installed alongside React 19; renderers can remain free of `dangerouslySetInnerHTML`.
- React 19 lint treats `Date.now()` inside component-scoped handlers as an impure component call; use an external timestamp helper.
- Remaining tour lint issues are intentional effect-driven animation/data state plus Fast Refresh exports. Move pure map helpers into a separate module and restructure effects to avoid synchronous state writes.
- Narration can avoid effect resets by remounting per step (already keyed), lazily initializing visible characters, and deriving “revealed” content from parent state; completion stays asynchronous.
- Map load can keep initial `loading=true` and only set retry state in the click handler. Reduced-motion camera updates can still be scheduled through a single requestAnimationFrame, eliminating synchronous effect writes.

## Product research
- Current ChatGPT exposes stop-generation, retry, editing a user message with a pencil action, and branching/continuing from earlier conversation state.
- Adopt the lightweight actions relevant here: stop, elapsed status, copy, edit/resend. Preserve the original persisted history rather than silently overwriting database messages.
