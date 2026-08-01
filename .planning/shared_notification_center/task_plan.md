# Shared notification center

## Goal

Create one shared account-actions cluster for every authenticated header: equal 40px bell/user controls, a user glyph instead of initials, and a theme-aware notification dropdown backed by the existing notification data flow.

## Phases

- [completed] Inspect notification routes, APIs, types, existing page behavior, and all header coverage.
- [completed] Design shared account/notification components with dark and Admin-light color variants.
- [completed] Implement list loading, newest-first ordering, unread badge, scroll area, per-item read toggle, mark-all-read, clear-all, and detail navigation using existing endpoints.
- [completed] Replace Home-only bell with the shared cluster everywhere and remove obsolete styles.
- [completed] Add focused tests, run lint/build, and complete diff hygiene.
- [completed] Remove temporary preview data and audit every popup action against the real notification API.
- [completed] Add a one-second live refresh loop with overlap/stale-response protection and no mock fallback.
- [completed] Extend focused tests for live refresh, then run lint/build and verify runtime API behavior.

## Constraints

- Preserve backend contracts; use existing notification endpoints where available.
- Keep all notification types visible and derive a safe generic presentation for unknown/new types.
- Use Lucide vector icons only; no emoji.
- Account and bell frames must be identical in size and layout on every page; Admin changes colors only.
