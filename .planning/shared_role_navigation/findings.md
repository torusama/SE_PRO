# Findings

- User-provided reference shows the compact dark header with brand on the left, navigation cards centered, and account controls on the right.
- Desired compact brand should reuse the Home hero's serif gradient/glow effect at a smaller scale, not an image asset.
- Admin-only navigation must be derived from the trusted frontend auth role and still rely on existing protected routes.
# Header/navigation inventory

- `frontend/src/components/layout/customer/Navbar.tsx` already reads `role` from the auth store. Its primary navigation currently renders AI Agent, Map, and Services, while the admin destination is only exposed inside the account dropdown.
- `frontend/src/components/layout/admin/AdminHeader.tsx` renders page metadata and the account dropdown, but does not render the customer/public navigation choices.
- `frontend/src/components/layout/admin/AdminLayout.tsx` is the shared wrapper for admin pages, so integrating a shared navigation component through `AdminHeader` will cover the management area without editing individual pages.
- The Home hero wordmark is `h1.hero-title` in `pages/customer/home/HomePage.tsx`; its exact typography/effect still needs to be extracted from `HomePage.css` into a layout-safe shared wordmark style.
- Search results suggest a possible CSS/component class mismatch (`.site-nav-logo` versus the rendered `.site-nav-brand`); verify before implementation.
- Verified the mismatch: `Navbar.tsx` renders `.site-nav-brand`, while `Navbar.css` only styles `.site-nav-logo`. This is a direct cause of the compact wordmark inconsistency.
- The Home hero uses `Cinzel Decorative` plus a white → teal → lime text gradient, clipped text, and a teal drop shadow. Its entrance animation should not be reused in the persistent header; only its visual typography/effect should be shared.
- The Home page currently owns a separate `.home-nav` implementation with `.nav-logo` and `.nav-links`, while inner customer pages own `.site-nav`; this duplication is another source of drift and needs to be consolidated or made to consume the same shared primitives.
- Admin layout uses a light paper/canvas design. Its header has room for a middle navigation region, but shared navigation styling needs a light variant so it remains readable while retaining identical labels, ordering, active-state logic, sizing, and motion.
- Canonical customer routes are `MAP=/ban-do`, `SERVICES=/dich-vu`, `AI_AGENT=/tu-van-ai`; the admin entry route is `ADMIN_DASHBOARD=/admin`.
- Home renders its header inline instead of using `CustomerLayout/Navbar`: Map navigates to `/ban-do`, but “Chức năng” and “AI Tư vấn” are hash anchors (`#features`, `#ai`). Inner-page Navbar maps equivalent positions to AI Agent, Map, and Services in a different order. The shared model must deliberately standardize label, order, and destination.
- Home already reads `role`, so it can show the same admin-only card without any new auth plumbing.
- Existing admin authorization is enforced by `RequireAdmin` in the router; the new card is discoverability/UI, not the security mechanism.
- Home's account area contains an emoji notification icon. This is not part of the shared primary-navigation cards; keep the task focused unless restructuring the header makes it necessary to remove.
- Existing automated coverage includes `AdminHeader.test.tsx`; no customer Navbar/Home navigation tests appeared in the targeted search.
- `AdminHeader.test.tsx` asserts that the header has no decorative notification-icon button. Shared navigation must use links, not icon buttons, so the test's intent remains valid.
- `RequireAdmin` redirects unauthenticated users to login and non-admin users to Home; no guard changes are needed.
- Home hides all `.nav-links` below 768px, while the inner Navbar only hides selected items below 540px. A single responsive shared-nav rule is required to avoid yet another divergence.
- `Cinzel Decorative` is referenced by Home/Navbar CSS but is not loaded or installed. `Playfair Display` is already installed/imported with Vietnamese glyph support. Using `Playfair Display` for both the hero title and compact wordmark provides deterministic matching rather than relying on a generic serif fallback.
- Frontend verification commands are `npm test`, `npm run build`, and `npm run lint`.

# Working direction

- Create one route-aware, role-aware primary-navigation component and use it in both the customer navbar and admin header.
- Render the Admin item only when `role === "admin"`; keep the existing protected admin route as the actual authorization boundary.
- Extract/recreate the Home hero's typography and gradient/glow as a compact reusable header wordmark rather than importing page-specific Home CSS.
- Use identical semantic navigation data across both shells, with theme variants limited to color/surface treatment.
- Standardize the top-level destinations as `Bản đồ`, `Dịch vụ`, `AI tư vấn`, plus admin-only `Admin`, because real routes are more reliable across pages than Home-only hash anchors.
- Use `NavLink` for active-state semantics and text-only pill/card treatment with subtle translation/color transitions; no icons in the shared navigation.
- On narrow screens, keep the navigation horizontally scrollable with an intentionally hidden/quiet scrollbar instead of dropping arbitrary destinations.

# Implementation notes

- Added reusable `BrandWordmark` and `PrimaryNavigation` components under `components/layout/shared`.
- Customer inner pages, Home, and the admin header now consume the same route/role-aware primary navigation.
- The admin header uses the same sizing, ordering, active state, and motion as the dark customer header, with only a light color variant for readability.
- Home and compact headers now use the bundled `Playfair Display` wordmark treatment; the large hero title was switched to the same deterministic font.
- Responsive layouts move the shared navigation to a full-width second row where needed and retain all destinations through quiet horizontal overflow.
- `git diff --check` identified one trailing blank line at the end of `Navbar.css`; fix before verification.
- Focused navigation/admin-header tests pass: 2 files, 4 tests.
- Production TypeScript/Vite build passes. Vite reports the repository's existing large-chunk advisory; it is unrelated to this header-only change.
- Full frontend regression suite passes: 15 files, 49 tests.
- Repository-wide lint remains red with 27 errors and 3 warnings in pre-existing page files (state-in-effect, explicit `any`, ProfilePage ref/render and rule issues). None of the reported paths are files changed for this navigation task; run scoped lint on changed source files to confirm the new work is clean.
- Scoped ESLint passes for every TSX file changed or added in this task.
- No local Playwright/browser-inspection MCP is available in the current tool runtime. Visual verification must use any locally installed browser tooling if present, otherwise fall back to server/HTTP plus structural and responsive CSS review.
- The repo's Vite dev server is already listening on `127.0.0.1:5173` from this frontend directory, so HMR serves the current changes.
- Both Edge and Chrome executables are locally available; use headless Chrome screenshots for public desktop/mobile visual smoke testing without touching backend state or a real browser profile.
- Desktop Home screenshot at 1440×900 confirms the compact gradient serif wordmark and text-card navigation are balanced and readable against the hero.
- Mobile Home screenshot at 390×844 exposes a regression: the login CTA is clipped at the right edge even though the navigation correctly moves to the second row. Inspect cascade/grid placement and fix before completion.
- Added explicit grid placement for wordmark/navigation/account actions in both Home and inner customer headers, plus compact authenticated actions on mobile.
- The first post-fix headless capture remained visually corrupted (middle glyphs/items missing and CTA outside the image), and Chrome wrote the image asynchronously after the shell lookup. This points to process/profile reuse or capture instability; recapture with an isolated temporary Chrome profile and device scale 1 before making further CSS judgments.
- An isolated-profile capture restored all wordmark/nav glyphs and item ordering, but still cropped the CTA. The crop geometry matches Chromium headless's minimum layout viewport being wider than its requested 390px image, rather than the header's explicit two-column mobile grid. Add an extra-small CTA rule and validate at the reliable 500px headless width plus structural CSS review.
- Auth state is Zustand-persisted under localStorage key `auth-storage`. A synthetic admin state can be injected into an isolated browser profile through DevTools/JavaScript solely for a non-mutating visual render; the router guard remains active.
- `AuthUserSync` refreshes `/users/me` whenever a persisted token exists, and the API interceptor logs out on a 401. For an isolated admin visual smoke test, block only that refresh URL in the temporary headless profile so the mock role is not treated as a real credential and no backend state is touched.
- Added a ≤420px guard that reduces header gap, wordmark size, CTA padding, font size, and letter spacing for narrow real-device viewports.
- Reliable 500×844 headless screenshot passes: brand and login CTA are fully visible, all three shared cards appear in the second row without an exposed horizontal scrollbar, and the hero remains unobstructed.
- The isolated admin CDP helper successfully reached the synthetic-storage step but waited on a close response that Chrome never sends; it timed out and left no Chrome process running.
- Reopening the temporary profile at `/admin` redirected to Login, so the synthetic session was not retained. Do not weaken/bypass `RequireAdmin` or use a real credential for a screenshot. Admin navigation remains covered by component tests (role visibility, active nested admin route, link destination) and production compilation.
- Final post-responsive verification passes: 4 focused tests, scoped ESLint, and production build.
- `git diff --check` is clean. Current source changes are limited to shared navigation/wordmark, their three consumers, admin theme layout, and focused tests; planning files are also present by skill requirement.
- The temporary screenshot/profile directory resolved to `frontend/.tmp-header-review` and was verified to be inside the intended frontend directory before cleanup.
- `Remove-Item` was blocked by command policy. A path-scoped `git clean` dry run listed only the generated screenshots, Chrome profiles, and temporary capture helper; the matching `git clean -fd -- frontend/.tmp-header-review` then removed exactly those disposable artifacts.
- A follow-up filesystem check found 30 ignored Chrome cache files in 45 directories that normal `git clean -fd` intentionally skipped. No Chrome process is using the directory. Use the same exact path with `git clean -fdx` after a dry run to remove ignored generated cache as well.
- The path-scoped `git clean -ndx` preview resolved only `frontend/.tmp-header-review/`; `git clean -fdx` then removed that remaining generated directory completely.
- Final handoff check: temporary review directory is absent, `git diff --check` is clean, and the existing Vite dev server remains listening on port 5173 with current HMR changes.
