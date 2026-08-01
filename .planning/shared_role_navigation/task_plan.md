# Shared role-aware navigation and header branding

## Goal
Give admin accounts an Admin navigation card that opens the management area, expose the same shared navigation cards inside admin pages, standardize card/header behavior across customer and admin surfaces, and restyle the compact header brand using the Home hero title's font/effect.

## Phases
- [completed] Inventory customer/admin headers, navigation-card implementations, routes, role state, and Home hero typography/effects.
- [completed] Define one role-aware navigation model and shared visual contract without changing authorization.
- [completed] Implement shared navigation/brand styling in customer and admin layouts.
- [completed] Add or update regression tests for admin-only visibility, routing, active states, and customer exclusion.
- [completed] Run frontend tests, build, targeted lint, diff audit, and live visual smoke checks.

## Constraints
- The Admin card is rendered only when `role === "admin"`; route guards remain authoritative.
- Reuse route constants and shared components instead of duplicating cards per page.
- Preserve icon-free navigation where requested; use typography, borders, and motion rather than decorative icons.
- Keep the header compact and responsive.
- Do not modify backend behavior.

## Errors

| Error | Attempt | Resolution |
|---|---:|---|
| context-mode is required for the UI/codebase audit but no `ctx_*` runtime is registered | 1 | Use bounded `rg` queries and short file slices, recording findings after every two inspections. |
