# Findings

- User clarified that parallel CSS is insufficient: this must become one actual shared component. All contexts need the same trigger/dropdown structure and menu destinations; Admin may differ only through light-theme color tokens.
- Shared layout folder currently contains only brand/navigation primitives, making it the correct location for a new `AccountMenu` primitive and its CSS.
- `Navbar` hides the account menu on the Profile route, so it is not currently present on every page. The shared conversion should remove that exception.
- Home, customer Navbar, and Admin each duplicate open-state/menu markup. Admin also uses a different trigger structure (name plus hint) and a different link set. These will all be replaced with one avatar-plus-name trigger and one role-aware destination set.
- Existing AdminHeader test expects only one account button and can continue to validate the shared trigger; new focused AccountMenu tests should cover open, Escape, outside click, and light/dark variants.
- UTF-8 inspection confirmed the source text is valid Vietnamese; the earlier mojibake was PowerShell's default decoding, not corrupt application source.
- After component adoption, the old `.home-nav-menu`, `.site-nav-menu`, and `.admin-account__menu` blocks are dead code and should be removed so future changes cannot silently diverge again.
- Cleanup search found only four stale selectors/keyframes left in responsive/reduced-motion sections; none are used by the new component and can be safely removed.
- Final stale-selector search returned no matches, confirming per-page account-menu implementations have been fully removed. `git diff --check` is clean apart from informational Windows line-ending warnings.

- Profile dropdowns are implemented separately in `Navbar.tsx`, `HomePage.tsx`, and `AdminHeader.tsx`; their markup and available destinations differ.
- The persistent customer `Navbar` already exposes the full role-aware set: profile, lots, appointments, Admin (for the admin role), and logout. The Home header currently exposes only profile/logout, while the Admin header exposes its own profile/admin/logout set.
- The correct unification target is shared visual styling and interaction treatment, not forcing every context to show the same menu items. Each page should retain the destinations appropriate to its existing layout and role.
- The customer menu is dark and currently uses a small 8px radius with no entrance transition, whereas the Admin menu is a warm-paper panel with a 180ms scale/fade animation. Their typography, spacing, borders, and active states also differ.
- Broad animation search shows the most conspicuous shared entrance effects are the Home hero's 1.0–2.0s staggered `fadeUp` sequence and Admin workspace's 360ms page entrance. Agent-specific animation is largely localized and already includes reduced-motion handling, so it should not be broadly rewritten in this pass.
- Home already carries `role` from the auth store, so its dropdown can be brought in line with the persistent customer navbar's role-aware destinations without adding new state or backend calls. It also still renders a bell as an emoji, which conflicts with the established Lucide icon direction.
- The Home menu uses the same dark context as the customer navbar; Admin uses its warm Admin theme. The shared treatment should therefore be consistent sizing, 12px radius, panel padding, restrained shadow, visible focus state, and a short 160ms fade/translate entrance—not a literal cross-theme color copy.
