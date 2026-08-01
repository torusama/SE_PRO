# Git synchronization

## Goal

Safely preserve the current worktree, integrate the latest remote branch, resolve any conflicts by retaining intended local and upstream behavior, verify the result, and push it.

## Phases

- [completed] Inspect branch, upstream, status, local commits, and worktree scope.
- [in_progress] Commit the intended local work without losing unrelated changes.
- [pending] Fetch/pull the upstream branch and resolve any conflicts.
- [pending] Run proportionate verification and push the integrated branch.
- [pending] Confirm remote/local commit alignment and clean status.

## Constraints

- Never discard local or upstream work.
- Do not use destructive reset/checkout operations.
- Inspect conflict targets before editing and preserve both sides' intended behavior.
