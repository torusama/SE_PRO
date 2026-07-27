# Pending reply and conversation sidebar scroll

## Goal

Fix short replies such as “gửi yêu cầu” so the active plot request continues correctly, and make the left conversation history independently scrollable instead of compressing the page.

## Phases

1. [completed] Trace pending-action continuation and locate conversation sidebar layout.
2. [completed] Implement deterministic short-reply handling and scrollable sidebar.
3. [completed] Add regression tests and verify backend/frontend builds.
4. [completed] Restart affected servers and smoke-test the reported flow.

## Constraints

- Preserve unrelated dirty-worktree changes.
- Keep the input composer and main chat scrolling behavior unchanged.
- The conversation list should scroll inside the available sidebar height while its header/account areas remain visible.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| None | 0 | — |
