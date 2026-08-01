# AI Agent application-level learning architecture

## Goal
Inspect, repair, implement, and verify a memory-augmented Cemetery Concierge Agent with isolated user memory, verified global knowledge, structured recommendation signals, and deterministic PlotRanker fallback, without retraining the external foundation LLM.

## Phases
- [completed] Establish repository baseline, preserve existing edits, and map the current backend/frontend/database/ML flow.
- [completed] Repair database schema, duplicate handling, versioning, audit, and learning-signal persistence.
- [completed] Repair planner/tool/context propagation, autonomous-learning classification, retrieval, and failure isolation.
- [completed] Repair prompts, PlotRanker policy/configuration, frontend feedback controls, and migration documentation.
- [completed] Add or update focused unit/integration tests for the required acceptance scenarios.
- [completed] Run available lint, build, test, migration/static, and ML validation commands; fix implementation-caused failures.
- [completed] Review final diff and document architecture, changed files, migration order, limitations, verification steps, and inspection queries.

## Constraints
- Preserve unrelated and pre-existing user changes.
- The foundation LLM remains frozen; no automatic LLM or PlotRanker training/deployment.
- Trusted identity, role, conversation/message IDs, statuses, and model metadata come only from backend context.
- Memory persistence failure must not block a valid primary business action.
- Context-mode runtime tools are unavailable; capture potentially large command output to files and surface focused summaries.

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| Initial `git status` ran one directory above the repository | 1 | Located `SE_PRO` and set it as the working directory. |
| Parallel baseline call returned failure because one command exited non-zero | 1 | Re-ran the required checks individually. |
| context-mode runtime tools are not exposed | 1 | Use bounded PowerShell queries and file-captured build/test output. |
| Broad `rg` pattern returned 416 lines and was truncated | 1 | Switch to explicit files and narrow patterns/context. |
| `rg` received Windows wildcard paths and emitted an invalid-path error | 1 | Use concrete directories/files in subsequent searches. |
| Broad frontend feedback/safety searches were truncated | 1 | Restrict inspection to exact Agent page/test/CSS and exact backend prompt files. |
| PowerShell did not expand `*.tsx`/`*.ts` arguments for `rg` | 1 | Use `rg -g '*.tsx' -g '*.ts' <directory>`. |
| `git diff --no-index` returned exit code 1 for an expected non-empty diff | 1 | Treat as an inspection result; do not repeat it as a validation failure. |
| A PowerShell `rg` command had an unterminated quoted pattern | 1 | Re-ran with separate `-e` patterns and simple quoting. |
| First focused Jest run: 1/49 tests failed because the assertion matched the column name `training_ready` as if it were an automatic training call | 1 | Narrowed the assertion to actual training tables/endpoints; implementation behavior was correct. |
| System Python did not have `pytest` installed | 1 | Used the repository's checked-in `.venv`, where all ML dependencies are installed. |
| Full-repository lint exposed existing failures in unrelated backend/frontend modules | 1 | Formatted and linted every AI feature file changed in this task separately; retain the honest baseline failure in the final report. |
| First E2E run found an outdated `/admin/ai-activity` path in the authorization matrix | 1 | Updated the test to the controller's real `/ai-agent/admin/ai-activity` route; all 142 E2E cases then passed. |
| A bounded source inspection used a repository-relative path while already inside `backend` and produced noisy missing-path output | 1 | Re-ran the inspection with the correct backend-relative path and a narrow `rg` context. |
