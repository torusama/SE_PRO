# Agent Inline Map Plan

## Goal
Replace the separate guided-tour/video experience with one continuous chat stream and a persistent contextual map panel that follows the agent's current plot recommendations.

## Phases
- [complete] Inspect current chat layout/CSS, map APIs, and encoding sources.
- [complete] Design continuous chat + contextual map state behavior.
- [complete] Implement inline split layout and remove automatic tour playback/UI.
- [complete] Fix visible Vietnamese/price encoding issues.
- [complete] Add/update tests and run frontend validation.
- [complete] Verify the running dev experience and finish handoff.

## Constraints
- Chat remains the primary interaction and continues normally after map opens.
- The map must focus authoritative backend plot IDs only.
- New recommendation responses update the map; non-recommendation replies keep the current map context.
- Preserve the existing dark teal/gold visual identity.
- Responsive/mobile layouts must remain usable.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
