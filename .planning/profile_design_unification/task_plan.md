# Profile design unification

## Goal

Use one real shared profile-menu component across Home, customer, profile, Agent, and Admin surfaces. Its structure, sizing, typography, spacing, menu items, interaction, and motion must be identical; Admin changes only the color tokens to suit its light theme.

## Phases

- [completed] Re-inspect every profile dropdown/header implementation and shared layout coverage.
- [completed] Build one shared AccountMenu component with dark/light color variants only.
- [completed] Replace Home, customer, and Admin implementations and remove duplicated menu CSS/state.
- [completed] Verify interactions, focused tests, lint/build, and diff hygiene.

## Constraints

- Frontend only; do not modify backend APIs or authorization behavior.
- Preserve page/header layout; the account control and dropdown itself should be structurally identical everywhere.
- Use the existing project fonts, colors, and Lucide icon system; no emoji.
