# Agent feedback and learning audit

## Goal
Trace user feedback from the frontend through persistence and determine whether, where, and how the agent currently reuses it to improve later responses.

## Phases
- [completed] Locate feedback entrypoints, APIs, services, and database schema.
- [in_progress] Trace all consumers of stored feedback, including prompts, ranking, and analytics.
- [pending] Inspect live database tables/counts without exposing user secrets.
- [pending] Report current behavior, exact journal location, and gaps.

## Constraints
- Read-only audit; do not mutate application data or implementation.
- Distinguish durable storage from actual online learning.
- Do not expose message content or personal data unless necessary.

## Errors
- context-mode runtime tools are not exposed in this session; use focused local commands with bounded output.
