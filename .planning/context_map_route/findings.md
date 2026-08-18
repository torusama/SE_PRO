# Findings

- The screenshot shows the expanded plot card consuming more vertical space than the contextual map.
- The three bottom actions use equal-width, high-emphasis sizing; only “Đặt yêu cầu” should remain the primary CTA.
- Desired route behavior is an in-panel mode switch: hide details and show the path directly on the small map.
- The full map already calculates a canonical polyline from the main/secondary gate through the nearest road and aisle to the selected plot. Those helpers are currently private to `MapPage.tsx`.
- `AgentContextMap` delegates SVG rendering to `GuidedTourMap` and owns the plot-details/actions state, so route mode should live in `AgentContextMap` and pass the selected route plot into `GuidedTourMap`.
- The old `onFindRoute` callback navigates from `AgentPage`; it can be removed once route state is local to the contextual panel.
- Route mode must change the camera bounds to include both the selected plot and its gate; drawing a polyline while keeping the existing plot-only camera would hide most of the route.
- The route geometry should be extracted into a shared frontend utility so the full map and guided map cannot drift.
- The normal card can retain all eight facts in a compact four-column, two-row grid with a one-line description; the action row should use content-sized secondary buttons and one flexible primary button.
- A route option identifier is safer than a plain boolean for route mode: changing recommendations automatically exits a stale route without a state-reset effect.
- Both normal and family plots can use one shared route utility; family plots correctly start from the secondary gate while other plots start from the main southern gate.
