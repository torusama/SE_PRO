# Admin AI Agent redesign and server-wide learning journal

## Goal
Redesign the Admin AI Agent experience into a clean, seminar-ready, icon-free interface; move its sidebar entry from above Dashboard to the bottom of the navigation; and make the AI journal describe application-wide learning and self-updates rather than individual user conversations.

## Phases
- [completed] Audit the current admin page, sidebar ordering, analytics payload, and existing learning journal semantics.
- [completed] Define the icon-free visual hierarchy and privacy-safe server-wide learning journal model.
- [completed] Implement the redesigned page, navigation ordering, and journal presentation.
- [completed] Add or update focused tests for layout, labels, journal semantics, and navigation order.
- [completed] Run targeted tests/builds and review the final diff.

## Constraints
- Preserve existing user changes and the working analytics endpoint.
- Do not use icons in the redesigned Admin AI Agent page.
- Place AI Agent at the bottom of admin navigation because no OTP Dashboard route exists and the current issue is that AI Agent appears above Dashboard.
- Do not expose or imply storage of individual chat transcripts in the learning journal.
- Describe learning accurately as application-level memory, verified knowledge, signals, ranker outcomes, and versioned updates—not foundation-model retraining.
- Reuse real persisted data; do not fabricate seminar metrics.

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| Frontend targeted test was launched from the repository root, which has no `package.json` | 1 | Re-run from `frontend` with paths relative to that package. |
| Journal tab test expected whitespace between nested button labels, but the accessible name concatenates them | 1 | Match the stable primary tab label `Nhật ký AI`. |
| A combined inspection used repository-relative frontend paths while running from `backend` | 1 | Re-run the inspection from the repository root. |
