# Progress

- Clarification received: reopen the task and replace the three separate menu implementations with a shared component rather than merely matching their CSS.
- Re-inspected shared layout primitives and all three menu implementations. Confirmed a new shared primitive can remove duplicated state/markup and make the Profile route consistent too.
- Next: create and test the shared AccountMenu, then adopt it in all headers.
- Added the shared AccountMenu primitive, a single token-driven CSS implementation with dark/light variants, outside-click/Escape dismissal, reduced-motion support, and focused interaction tests.
- Next: replace each duplicated header implementation with the shared primitive and remove dead styles/state.
- Added the role-aware UserAccountMenu wrapper and adopted it in Home, customer Navbar, Profile-route coverage, Agent/customer layout, and AdminHeader. Replaced the Home notification emoji with the existing Lucide Bell while editing the header.
- Next: remove all obsolete per-page menu CSS, then run focused tests and build verification.
- Removed the duplicated base menu/trigger CSS from Home, Navbar, and Admin. A follow-up search identified a few stale responsive/keyframe references for final cleanup.
- First verification build failed because Home uses `role` again in a lower page section unrelated to the menu. Restore that existing auth selector while keeping the removed menu state/logout selectors out.
- Restored the Home role selector used by the reminders card. Focused tests pass (3 files, 6 tests), scoped lint passes, and the production build succeeds.
- Removed the final stale responsive/keyframe selectors; final search found no legacy account-menu implementation and diff hygiene is clean.
- All plan phases are complete.

- Started a frontend-only visual unification pass for profile menus and shared page motion.
- Next: map the customer and Admin profile implementations before editing.
- Mapped the profile-menu entry points and confirmed the menus need visual unification while retaining their page-specific links.
- Next: inspect their concrete markup/CSS plus global entrance-animation definitions.
- Compared customer/Admin menu styling and identified the Home and Admin page-entry effects as the priority animation targets.
- Next: inspect Home menu CSS and existing global reduced-motion coverage, then implement the shared visual rhythm.
- Confirmed Home can reuse the role-aware link set and identified its legacy emoji bell.
- Next: apply the shared menu rhythm across Home/customer/Admin and shorten the Home/Admin entrance motion.
- First combined patch failed because the Home notification label/icon is stored with an encoding representation that did not match the patch context. No source changes were applied; split the visual CSS and component edits into smaller patches instead.
- Applied the shared 220px profile-menu rhythm across customer/Home/Admin: 12px outer radius, 6px panel padding, 8px item radius, stronger readable text, short entrance, and contextual page colors.
- Expanded the Home profile menu to match the existing role-aware customer options while keeping Admin-specific navigation conditional on the admin role.
- Shortened Home hero and card entrances substantially, reduced movement from 24/20px to 10px, and added a reduced-motion fallback for Home's entry effects. Admin's workspace entrance is also less pronounced (4px).
- Next: run focused profile-menu tests and final diff hygiene.
- Admin header focused test passes (2/2); scoped lint and a fresh production build both pass.
- Next: final diff check and plan completion.
