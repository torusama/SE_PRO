# Findings

- `AgentPage` is already a flex chat column with its own scroll area and fixed composer; it can remain unchanged inside a new workspace grid.
- Desktop shell currently has sidebar + one chat column. The clean structure is sidebar + workspace, where workspace becomes chat/map when recommendations exist.
- The existing `GuidedPlotTour` is an absolute overlay with autoplay, typing, steps, and controls—the exact behavior the user rejected. It should be removed from `AgentPage` usage rather than slowed down.
- `GuidedTourMap` can be reused as the contextual map renderer if given a single static focus step; no playback UI is required.
- Visible mojibake is data-driven (`Khu D â€” Bình Dân`/currency artifacts), not a font-family problem. `MapPage` already contains ad-hoc mojibake cleanup logic, but the AI workspace lacks a shared sanitizer.
- `AgentPage.css` has layered readability overrides; new split-map rules should be appended narrowly to avoid disturbing the current chat sizing.
- Recommendation cards currently display raw `zoneName`, directions, reasons, and currency output; those are the visible entry points for mojibake.
- Clean zone labels can be reconstructed from the authoritative plot-code prefix via `CEMETERY_ZONE_LAYOUT`, avoiding unreliable corrupted database labels.
- Inline “Xem bản đồ” should focus/open the contextual panel; only the panel's explicit “Bản đồ đầy đủ” action should navigate away from chat.
- Final behavior is covered by integration tests: recommendations open/update the contextual panel, while ordinary follow-up answers preserve its current focus.
- The running Vite server serves `AgentContextMap`, `has-context-map`, and display normalization, with no `GuidedPlotTour` overlay in active `AgentPage`.
