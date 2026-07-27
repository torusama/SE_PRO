# Map and Comparison Cleanup Plan

## Goal
Make comparison readable and contained within chat, and simplify the contextual map so focused/clicked plots use one clean information card without overlapping labels or redundant UI.

## Phases
- [complete] Inspect comparison/map components and capture screenshot findings.
- [complete] Redesign comparison containment and readable typography.
- [complete] Remove overlapping SVG labels and add plot selection callbacks.
- [complete] Simplify the map information card and actions.
- [complete] Add/update tests, build, lint, and verify Vite output.

## Screenshot Findings
- The comparison card begins inside the chat but its content scale is too small for the available space.
- Long plot-code and zone strings are mojibaked and visually cramped.
- Active SVG labels for three adjacent plots overlap into one unreadable white string.
- The map repeats context in the header, floating focus badge, four stat boxes, reason row, price row, and action row.
- The desired hierarchy is map first, then one compact card for the currently selected plot/option.

## Constraints
- Preserve continuous chat + right-side contextual map.
- Keep authoritative plot IDs and map highlighting.
- Clicking a plot or selecting an option must update one detail card.
- Remove visual noise before adding anything new.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Selected plot card test found the plot code duplicated in map header and card | 1 | Remove the code from the header; keep it only in the selected-plot card to further reduce density. |
| Full lint rejected an anonymous mocked component using `useEffect` | 1 | Name the test mock `MockGuidedTourMap` so React hook linting recognizes it as a component. |
