# Compact contextual map and inline route

## Goal
Balance the small map and plot information card, compact the action controls, and render route guidance directly inside the contextual map without navigating to the full map page.

## Phases
- [completed] Trace the existing full-map route rendering and contextual map component boundaries.
- [completed] Add an inline route mode to the guided map and contextual panel state.
- [completed] Rebalance map/card heights and compact the actions responsively.
- [completed] Update tests, lint/build, and verify the running frontend.

## Guardrails
- Use the same canonical map landmarks and route semantics as the full customer map.
- Route mode hides plot details but must provide a clear way back.
- Do not navigate away from the Agent page when “Tìm đường” is clicked.
- Preserve full-map navigation as an optional secondary action.

## Errors Encountered
- context-mode runtime tools are not exposed in this session; use compact direct commands and summarize outputs.
- Tried to read a non-existent `GuidedTourMap.css`; the map styles live in `GuidedPlotTour.css`. Continue with the correct file.
- PowerShell does not support Bash-style brace expansion in the `rg` path used during inspection; reran with explicit paths.
