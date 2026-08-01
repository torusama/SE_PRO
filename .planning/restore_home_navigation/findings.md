# Findings

- User correction: the original Home navigation was the intended reference. The newly added bordered/background pill treatment is wrong and must be removed everywhere while retaining shared route/role logic.
- User correction: the hero eyebrow is difficult to read because it mixes Chinese characters with heavily tracked Vietnamese. It should become one centered Vietnamese-only line in a legible font.
- The shared navigation currently diverges from old Home through `border`, `border-radius`, padding, colored backgrounds, 6px gap, and a translate hover. The old Home reference used plain uppercase text, 32px spacing, muted text, teal hover/glow, and no link box.
- Home and customer layouts already place the shared nav in the centered middle grid column; admin uses `margin-inline: auto`. The correction can keep that placement and change only the shared visual contract.
- The target eyebrow is `花 好 月 圓 — Hệ thống Quản lý Nghĩa trang`; its CSS uses `Noto Serif SC` and `0.4em` tracking. Replace the content with Vietnamese-only text and use `Be Vietnam Pro` with moderate tracking/line-height and explicit center alignment.
- The footer has a separate Chinese/Vietnamese decorative line, but the screenshot and request target the hero eyebrow. Keep the correction scoped to that referenced line.
- Exact desktop centering needs the original Home positioning technique (`left: 50%` plus translate), because a three-column grid can appear off-center when the brand and account controls have different widths. Home, customer, and admin headers now share that exact center placement, with normal second-row flow restored at responsive breakpoints.
- Post-change verification passes: 4 focused navigation/admin-header tests, scoped ESLint for changed TSX, and the production TypeScript/Vite build. Vite's large-chunk/plugin timing notices are unrelated existing advisories.
- Desktop Home screenshot confirms the restored navigation matches the old reference: plain uppercase text, no boxes, and exact viewport centering.
- The Vietnamese eyebrow is centered and the content is correct, but the screenshot shows it too dim because it still inherits the delayed opacity animation. Remove that animation for this line and slightly strengthen font/color so it is readable immediately.
- Final eyebrow styling removes delayed opacity/animation, uses Be Vietnam Pro at 600 weight, moderate `0.06em` tracking, and higher-contrast warm gold. The recapture confirms the Vietnamese-only line is clearly readable and centered.
- The second headless image cropped portions of the header edges due an unstable reused viewport, so it is not used to reassess navigation. Navigation centering/plain-text styling already passed in the first stable desktop image; the second image is used only for the centered eyebrow, which is fully visible.
- A path-scoped `git clean -ndx` preview identified only `frontend/.tmp-nav-review/`; the matching `git clean -fdx` removed all generated screenshots and isolated Chrome profiles.
- Final diff hygiene is clean, no temporary visual-review directory remains, and the Vite server continues listening on port 5173 with the corrected UI loaded through HMR.
