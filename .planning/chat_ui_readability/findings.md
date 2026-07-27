# Findings

## User screenshot
- At 1912×862, the sidebar is 267 px but most text is visually around 9–12 px.
- Assistant header text visibly overlaps/falls back around “Trợ lý Vĩnh Phúc Viên”.
- Empty state is constrained to a narrow center column despite abundant width.
- Composer is only about 48 px tall and roughly 860 px wide; its text and helper note are too small.

## Research
- Current ChatGPT and Claude layouts consistently keep history in a persistent left sidebar and dedicate the remaining viewport to a single primary chat workspace.
- Their empty states put the greeting immediately above a substantial composer, rather than separating the composer at the extreme bottom with a large dead zone.
- The composer is a visually dominant rounded surface with comfortable padding and action controls; common task shortcuts sit near it.
- Readability comes from restrained content width, but the main column and input remain materially wider/taller than the current implementation.
- Keep these interaction patterns only; retain Vĩnh Phúc Viên's own colors, typography, iconography, and content.

## Local implementation
- Main files are `frontend/src/pages/customer/ai-agent/AgentPage.tsx` and `AgentPage.css`.
- The page declares `Be Vietnam Pro`/`Inter` and `Playfair Display`, but contains no local `@font-face`; actual loading source still needs confirmation.
- Relevant CSS is concentrated in the shell/topbar, welcome state, starter grid, message column, composer, and responsive blocks.
- The screenshot's title collision is in the assistant identity area, not the global navigation brand.
- Desktop sizes confirm the screenshot: identity title 12 px, status 9 px, welcome eyebrow 8 px, body 12 px, starter title 11 px/body 9 px, textarea 11 px, disclaimer 7 px.
- Main message/composer column is capped at 920 px and the composer textarea starts at only 36 px high.
- Welcome state reserves `calc(100dvh - 290px)`, centering suggestions far from the bottom composer and creating an oversized dead zone.
- Shell sidebar is 286 px; this is reasonable, but its internal labels are also undersized.
- The title collision is not caused by duplicated JSX: `Trợ lý Vĩnh Phúc Viên` appears once. It is therefore a CSS/font metrics issue, likely amplified by a zero/too-tight inherited line height or unloaded font.
- Existing DOM already has the right semantic regions; the requested change can be CSS-first without touching API/history behavior.
- Composer has a single textarea/send button and supports auto-growing JS behavior; larger min/max height can be implemented safely in CSS.
- `Be Vietnam Pro` and `Inter` are loaded globally. `Playfair Display` is referenced by the welcome heading but is not imported, so it falls back to Georgia.
- No `scale()`/`zoom` applies to the agent page. The perceived tiny scale is entirely from explicit 7–12 px component sizes.
- The identity heading has no explicit line-height. Adding one plus a stable Vietnamese-capable font stack will eliminate font-metric clipping/collision.
- Sidebar labels repeat the same readability issue (history label 9 px, titles 11 px, dates 9 px, account subtitle 8 px).
- Current mobile overrides shrink explanatory copy to 10 px and starter cards to 68 px; the redesign must keep mobile text at 12–14 px while avoiding excessive height.
- Existing breakpoint at 900 px already turns the sidebar into a drawer, so desktop widening can be isolated above that breakpoint.
- Live conversation content is also undersized: message copy 12 px, timestamps 8 px, option labels/body 8–9 px, option actions 9 px.
- A complete readability fix must scale message bubbles and recommendation cards too, otherwise only the empty state would improve.
- Target desktop scale: primary copy 15 px, secondary copy 12–13 px, labels no lower than 10–11 px, 44 px controls, ~1120 px content/composer column.
- Headless Chrome at the user's exact 1912×862 viewport confirms the assistant title now renders once, cleanly and with proper spacing.
- Desktop composition now uses the available canvas: 940 px starter grid and 1120 px composer, with readable labels and a 68 px input surface.
- The visual identity remains intact: navy canvas, cyan controls, gold eyebrow, serif welcome heading.
- Mobile capture at 390×844 shows the new text scale is readable, but the surrounding site layout exposes a wider-than-viewport canvas: the welcome heading and starter cards clip at the right edge.
- Add an explicit `100vw` boundary to the agent page/chat at the mobile breakpoint and force the heading to wrap normally.
- A second 390 px headless capture remained cropped even after the page was explicitly bounded to `100vw`; Chrome headless is likely laying out at its minimum ~500 px window and cropping the screenshot. Verify at a 500 px viewport rather than repeatedly changing correct responsive CSS.
- The 500×900 responsive capture renders correctly with no horizontal clipping: heading fits, cards are single-column and readable, title remains clean, and the composer spans the usable width.
