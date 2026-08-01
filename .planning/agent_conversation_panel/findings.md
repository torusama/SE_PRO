# Findings

- User wants the conversation list to stop permanently consuming layout width. It should be an overlay panel that opens on demand and closes by interacting outside.
- `AgentPage` already has `sidebarOpen` state, an open menu button, a close button, and an outside-click overlay in the DOM. The current CSS makes the sidebar a permanent 286px grid column on desktop and only turns it into an overlay inside a mobile breakpoint.
- The solution is therefore a frontend CSS/layout promotion: make the existing state-driven overlay behavior apply at desktop too, keep the chat workspace as the full-width base layout, and retain the existing buttons/handlers.
- The existing Agent design tokens (`--agent-bg`, `--agent-sidebar`, teal borders, 160ms transitions) can be reused, avoiding a separate design system or new icons.
- The existing close and overlay controls work through `setSidebarOpen(false)`; no backend or conversation mutation is involved. The topbar opener already uses `setSidebarOpen(true)`.
- Existing CSS at `@media (max-width: 900px)` implements the desired behavior (fixed, translated sidebar and overlay) but desktop retains a `286px` shell column and hides both controls.
- A focused Agent page test file exists but has no sidebar open/close coverage; add a small interaction test that asserts the `sidebar-open` state class toggles through the existing buttons.
- Later “readability pass” CSS changes the permanent sidebar width to 310px and topbar height to 72px, but does not override `display`/position. Updating the base shell/sidebar rules will therefore make the overlay behavior consistent at desktop while the existing mobile media rules continue to provide their narrower fixed variant.
- Desired desktop behavior can be implemented with no new component: shell becomes a full-width block; sidebar becomes a translated absolute panel; existing menu/close/overlay controls become visible; and the workspace naturally uses the full width so its centered message column aligns with the global header.
- `AgentPage` already imports `useEffect`; add a small `Escape` keyboard listener conditioned on `sidebarOpen`. The menu should expose `aria-expanded` and `aria-controls` pointing to the existing conversation panel for accessible state feedback.
- Implemented the desktop overlay conversion: sidebar is now an absolute translated panel, workspace is full-width when closed, and the existing menu/close/outside controls are visible and state-driven across desktop.
- The focused interaction test passes (6 tests total): menu opens the panel, Escape closes it, and the outside overlay closes it. The panel state also updates `aria-expanded`.
- The unauthenticated headless browser was redirected to Login before it could render `/tu-van-ai`, which is expected from the route guard. No real user credential or authorization bypass is used for visual testing.
- Scoped ESLint for the changed Agent page/test and the production TypeScript/Vite build both pass. Vite's existing large-chunk advisory is unrelated to this layout change.
- A path-scoped `git clean -ndx` preview identified only `frontend/.tmp-agent-review/`; the matching cleanup removed the generated screenshot and browser profile without touching application source.
- After converting the shell from grid to block, explicitly set `.agent-workspace { height: 100%; }` so the chat and composer retain their full available height. Focused Agent tests (6/6) and a fresh production build pass after this final layout safeguard.
- Final hygiene passes: `git diff --check` is clean, the temporary review directory is absent, and Vite remains live on port 5173 with HMR serving the change.
- The conversation controls are most legible as icon-only buttons: `MessageCircle` opens the history panel and a standard `X` closes it. Both come from the project's Lucide icon set and preserve the established visual language without emoji or text noise.
