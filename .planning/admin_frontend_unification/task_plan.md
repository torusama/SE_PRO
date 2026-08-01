# Admin frontend visual unification

## Goal
Unify the entire frontend Admin Portal with the refined AI Agent visual language: warm neutral surfaces, restrained typography, consistent scale and spacing, text-first controls, no icons or emoji, and no generated “AI dashboard” effects.

## Phases
- [completed] Inventory every admin route, shared layout component, stylesheet, inline style pattern, icon/emoji use, and typography inconsistency.
- [completed] Define shared admin design tokens and reusable page-level patterns without changing behavior or APIs.
- [completed] Refine shared AdminLayout, header, sidebar, and global admin theme.
- [completed] Refine every admin page in bounded groups while preserving existing logic.
- [completed] Add/update frontend tests for shared navigation and icon-free rendering.
- [completed] Run frontend-only lint, tests, build, diff audit, and live verification.

## Constraints
- Frontend only. Do not modify, format, test-edit, or migrate any backend or ML-service file.
- Preserve all API calls, request shapes, routes, permissions, and business behavior.
- Use the refined AI Agent page as the canonical visual reference.
- Remove icons, SVG icons, emoji, decorative glyphs, gradients, glow, and oversized template-like typography from admin UI.
- Keep semantic data visualizations when useful, but simplify their styling.
- Preserve responsive usability and table overflow where structurally necessary.
- Preserve unrelated user changes.

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| Combined PowerShell audit command had an unterminated quote in the CSS-import regex | 1 | Split the route/icon/import audits into simpler commands with single-quoted patterns. |
| PowerShell per-page summary pipeline produced an empty-pipe parser error | 1 | Replace the brittle one-liner with a small read-only Node summary script. |
| Shared layout files were read from `layouts/admin`, but the repository keeps them in `components/layout/admin` | 1 | Located the exact paths with `rg --files` and continued from the component directory. |
| Font-token search pattern began with `--`, so ripgrep parsed it as an option; the first retry also placed glob flags after the separator | 2 | Confirmed the tokens from the useful output and use `rg -g ... -- pattern path` for later searches. |
| Notification page was assumed to be under `notifications/` | 1 | Located it under `notification-management/` with `rg --files`. |
| A plan update accidentally included an empty second file hunk | 1 | Removed the empty hunk and applied only the intended task-plan update. |
| Changed-file lint surfaced 8 strict React-hook/typing errors | 1 | Fixed the two errors in newly rewritten Activity/Notification pages; the remaining six are pre-existing patterns in legacy workflow files that were only visually adjusted. Build and tests remain green. |
