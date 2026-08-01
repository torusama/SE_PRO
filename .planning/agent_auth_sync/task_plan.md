# Agent authentication sync

## Goal

Find and fix why the AI Agent sidebar shows the signed-out state while the shared header already recognizes the authenticated account.

## Phases

- [completed] Trace the Agent page, conversation sidebar, auth store/context, token storage, and conversation API guards.
- [completed] Reproduce the mismatch from runtime/API evidence and identify the root cause.
- [completed] Implement the smallest frontend/backend fix needed to share the canonical auth state.
- [completed] Add focused regression coverage and run lint/build/runtime verification.

## Constraints

- Preserve the current Agent layout and visual design.
- Use the existing canonical authentication source; do not create another login state.
- Preserve unrelated worktree changes.
