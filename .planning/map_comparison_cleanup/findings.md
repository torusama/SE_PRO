# Findings

- Screenshot confirms comparison typography, overflow, SVG label collision, and redundant map detail density.
- `ComparisonPanel` uses raw zone/direction values, `₫`, 8–11px header text, and 9px cells; it needs the shared display sanitizer and a contained scroll surface.
- The comparison itself is in the chat message column, but its table has no minimum column widths or containment safeguards for the new narrow split-chat layout.
- `GuidedTourMap` explicitly renders a `<text>` label for every active plot. Removing that block eliminates the overlap without affecting highlight rectangles.
- Plot click currently only pauses camera motion; adding an `onPlotSelect` callback can drive a single selected-plot card.
- Final Vite source has no SVG plot/zone label rendering, includes the selected-plot card, uses clean comparison prices, and contains comparison overflow/font rules.
