# Home lower-section refinement

## Goal

Refine the Home page below the existing hero: remove the house illustration, tighten awkward whitespace, use functional Map/AI previews that match the built product, and add restrained scroll-reveal motion while preserving the site palette and hero.

## Phases

- [completed] Inspect Home structure/styles and the live Map/AI design language; identify the house asset and whitespace source.
- [completed] Research compact product-landing composition patterns and define the lower-section layout/motion rules.
- [completed] Implement the visual refinement without changing the hero section.
- [completed] Verify responsiveness, motion fallback, lint, and production build.
- [completed] Follow up on the Home illustrations: restore a restrained multi-message chat animation, keep previews non-navigational, add explicit CTAs, and tighten content/reveal rhythm.
- [completed] Restore a visible service introduction in the Home flow and verify the updated interactions and build.
- [in_progress] Eliminate global typography collisions on Home, redesign paired section headings so phrases stay together, and make text reveal motion clearly visible and staggered.
- [pending] Verify the typography and motion source, lint, production build, and live dev server.

## Constraints

- Do not modify the current first hero section other than removing the unwanted house visual if it belongs to that area.
- Stay within the current deep-navy, teal, violet, and restrained-gold palette.
- Reuse code-native previews; do not add generic AI/stock imagery or new bitmap assets.
- Respect `prefers-reduced-motion`.
