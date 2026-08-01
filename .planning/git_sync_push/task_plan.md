# Sync local work with origin/main and push

## Goal
Preserve the complete current worktree, integrate the latest `origin/main`, resolve any conflicts without dropping either side's valid work, verify the merged result, and push `main`.

## Phases
- [completed] Audit branch, remote, worktree scope, upstream divergence, and accidental sensitive/generated files.
- [in_progress] Commit the intended local worktree as a recoverable checkpoint.
- [pending] Pull/rebase the latest `origin/main` and resolve conflicts if present.
- [pending] Run proportional post-integration tests/builds and inspect the final diff/history.
- [pending] Push `main` to `origin` and verify local/remote commit parity.

## Safety constraints
- Preserve every existing local change unless it is clearly generated, sensitive, or unrelated junk.
- Do not use destructive reset/checkout operations.
- Do not force-push.
- Inspect conflicts file by file and combine valid local/remote behavior.
- Do not include secrets, runtime logs, build output, or dependency directories.

## Errors

| Error | Attempt | Resolution |
|---|---:|---|
| context-mode is required for git audit but no `ctx_*` runtime is registered | 1 | Use bounded git summaries and redirect any large test output to temporary logs. |
