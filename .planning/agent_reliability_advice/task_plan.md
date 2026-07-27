# Agent reliability and richer plot advice

## Goal

Make plot advice production-safer and more useful: never recommend unavailable plots, handle expired holds and stale prices, explain unavailable plot codes, compare options proactively, and correctly support family/clan plot requests.

## Scope

- Backend availability lifecycle and reservation confirmation safeguards.
- Agent planning, grounding, tools, prompts, and recommendation behavior.
- Focused unit/integration tests for sold/pending/locked/deleted, concurrency-sensitive paths, price changes, and family/clan groups.
- Minimal frontend changes only if response metadata requires them.

## Phases

1. [complete] Audit current schema, recommendation model, prompt/tool loop, and tests.
2. [complete] Design lifecycle fixes and family/clan intent semantics.
3. [complete] Implement backend and prompt changes.
4. [complete] Add regression tests and run focused suites.
5. [complete] Run full backend/frontend verification and restart affected server.

## Decisions

- Database state remains authoritative; the LLM may explain and choose but cannot override availability.
- Family/clan requests must resolve to adjacent multi-plot groups or an explicitly compatible family plot type, never arbitrary single plots.
- Preserve all unrelated dirty-worktree changes.

## Verification

- Focused Agent/reservation suites: 5 suites, 48 tests passed.
- Full backend Jest suite passed before scoped lint.
- Scoped ESLint: zero errors and zero warnings after formatting/test-helper cleanup.
- Backend build: passed.
- Live Agent smoke: HTTP 201, three family recommendations, all returned plots `plotType=family`, proactive comparison present, and map actions emitted.
- Restarted backend: PID 9408; `/api/plots/map` returns HTTP 200 with 36 plots.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Session catch-up command used PowerShell syntax inside context-mode Bash | 1 | Re-ran with Bash-compatible path and `$(pwd)` |
| Assumed planner/grounding filenames ended in `.service.ts` | 1 | Locate actual files before targeted reads; no code was changed |
| Windows `rg` command used a wildcard path that was not expanded | 1 | Locate spec filenames first or search the directory without a wildcard |
| Planning progress patch contained a malformed hunk separator | 2 | Reissued updates without a stray hunk marker before the second file |
| Scoped ESLint failed on CRLF/indent formatting after patching Windows files | 1 | Run Prettier only on task-owned files, then rerun lint/build |
