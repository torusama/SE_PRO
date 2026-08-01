# Sync local work with origin/main and push

## Goal
Preserve the complete current worktree, integrate the latest `origin/main`, resolve any conflicts without dropping either side's valid work, verify the merged result, and push `main`.

## Phases
- [completed] Audit branch, remote, worktree scope, upstream divergence, and accidental sensitive/generated files.
- [completed] Commit the intended local worktree as a recoverable checkpoint.
- [completed] Pull/rebase the latest `origin/main` and resolve conflicts if present.
- [completed] Run proportional post-integration tests/builds and inspect the final diff/history.
- [in_progress] Push `main` to `origin` and verify local/remote commit parity.

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
| ML test command `python -m pytest` failed because the active Python installation has no `pytest` module | 1 | Inspect the repository's declared ML environment/runner before choosing a different test command; do not install or retry blindly. |
| Optional environment-file inspection returned exit 1 when unmatched filename patterns were passed to `Get-ChildItem` | 1 | The useful inspection still revealed `.venv`; subsequent checks use explicit `Test-Path` and literal paths. |
| Post-rebase frontend build failed: `ProfilePage.tsx(612,11) TS2554 Expected 3 arguments, but got 4` | 1 | Remote changed the auth store `setAuth` contract; inspect the store and profile call, update the stale caller, then rerun frontend tests/build. |
| Targeted auth/profile ESLint surfaced 13 `react-hooks/refs` errors and one warning around legacy image-render code near `ProfilePage.tsx:2525` | 1 | These pre-existing full-file lint findings are unrelated to the integration fix; record them without broadening the sync into a risky image-viewer refactor. Build/tests remain the merge gate. |
