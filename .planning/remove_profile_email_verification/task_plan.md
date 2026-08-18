# Remove profile email verification

## Goal
Remove redundant email-verification controls from customer profile updates because registration already verifies the account email, while preserving normal profile editing and account security.

## Phases
- [complete] Inspect frontend profile UI and backend update contracts.
- [complete] Remove the redundant UI/workflow with minimal compatible changes.
- [complete] Run focused checks and build, then verify the running app.
- [complete] Trace the remaining email label and repeated profile-completion prompt.
- [complete] Fix stale UI/state and required-field calculation.
- [complete] Rebuild, restart, and verify against the affected account shape.

## Guardrails
- Do not weaken registration email verification.
- Do not remove password or phone verification.
- Preserve unrelated user changes.

## Errors Encountered
- Combined patch for modal invocation, alert copy, and `EmailModal` removal did not match the component tail exactly. Resolution: split into smaller patches after inspecting the current lines.
- A verification search used Bash `||` syntax under Windows PowerShell. Resolution: rerun with PowerShell-native exit handling.
