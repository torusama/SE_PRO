# AI Agent & Admin Knowledge Flow Review — 2026-08-10

## 1. Admin knowledge review flow

### Intended flow
1. Customer/admin proposes global FAQ/business knowledge.
2. The proposal is stored as `quarantined` and is **not** used by RAG.
3. Admin opens **Kiểm duyệt tri thức**.
4. **Duyệt**: requires an audit note (>= 5 characters), changes the proposal to `active`, versions/audits it, then asynchronously creates its embedding.
5. **Từ chối**: can be done immediately or with an optional reason, changes the proposal to `rejected`, keeps `is_active = false`, and records version/audit history.
6. RAG only retrieves global rows where `validation_status = 'active'` and `is_active = true`.

### Problems found and fixed
- The Admin UI required a >= 5 character note for **both** approve and reject. A blank reject therefore never sent the PATCH request and looked like a broken button.
- `ReviewKnowledgeDto` also required the note for both actions even though `KnowledgeService` already has a safe default rejection reason.
- The UI hid the real backend error behind a generic message, which made database/schema failures difficult to diagnose.
- Older deployed schemas can keep a same-named CHECK constraint that does not accept newer `rejected` values. Migration `016` only creates these constraints if the name does not already exist, and applied migrations are checksum-protected. A new repair migration is therefore required instead of editing an old migration.

### Fixes
- Reject note is now optional in the API contract and Admin UI.
- Approval is still protected: frontend and service both require an explicit audit note >= 5 chars.
- Admin UI now surfaces the backend error message when available.
- Added `031_ai_knowledge_review_rejection_fix.sql` to drop/recreate knowledge review CHECK constraints with `rejected` support and force quarantined/rejected/superseded global entries inactive.

## 2. Feedback -> verified knowledge flow

### Problem found
The old flow first committed feedback as `approved`, then called `applyApprovedCorrection()` in a second transaction. If the knowledge write failed, the feedback remained `approved` even though no correction was applied. A retry then failed with `Feedback was already reviewed`.

### Fix
If applying the correction fails, the feedback row is returned to `pending` (provided it was not applied), so an administrator can retry safely. The knowledge application itself remains transactional.

Also fixed Admin labels to match the real feedback types used by the backend:
- `helpful`
- `bad_recommendation`
- `wrong_information`
- `irrelevant_answer`
- `other`

Legacy labels remain supported for old rows.

## 3. Plot recommendation flow

### Root cause of the short/template-like answer
The backend already had `composeAgentResponse()` with an LLM consultation prompt, but the successful plot tool path explicitly skipped it and returned `describePlanResult()` / `describeRecommendations()` directly. Therefore the user normally received a deterministic backend formatter, not an LLM-written consultation.

### New flow
1. Planner/local routing determines that plot discovery is needed.
2. Backend tool queries/ranks **real available inventory** and calculates the structured facts (plot codes, listed price, total area, zone, direction, adjacency, entrance-access summary, reasons/trade-offs, internal matching-inventory price context, etc.).
3. That structured tool result remains the **authoritative source of facts**.
4. The LLM now receives the authoritative result and writes the final customer-facing decision brief. The existing multi-provider router starts normal customer generation with the configured `openai-secondary` 120B route, then falls back to the smaller/backup providers if needed.
5. A grounding validator rejects a response that invents plot codes/counts, unsupported Feng Shui claims, deposit-readiness claims, skips returned options, has no trade-off/recommendation, is too shallow, or does not continue the consultation naturally.
6. Only if the LLM/provider fails or the result fails grounding validation does the deterministic formatter appear as an emergency fallback.

### Consultation depth rules added
For every returned option the LLM is instructed to explain, when those fields actually exist:
- total listed price and approximate per-plot price for groups;
- total area;
- cemetery zone;
- direction (without pretending direction alone proves Feng Shui suitability);
- adjacency and family/clan-planning implication;
- verified entrance-access summary;
- strongest fit against the customer's known priorities;
- the most important trade-off/uncertainty.

It must then compare the options across the customer's priorities, say who each option fits best, and produce a reasoned final ranking. It must not invent legal status, road width, scenery/noise, investment value, scarcity, spiritual benefits, burial capacity, or maintenance burden.

The normal target is now:
- 1 option: about 180–320 Vietnamese words.
- Multiple options: about 320–620 Vietnamese words.

The grounding minimum was also raised so an obviously short answer is rejected.

### UI distinction
The structured card's deterministic field `analysisSummary` is now labelled **Tóm tắt đối chiếu dữ liệu**, not **Nhận định tư vấn**. The actual nuanced consultation is the LLM-written chat answer; the card remains an auditable summary of backend facts.

## 4. Files changed

Backend:
- `backend/database/migrations/031_ai_knowledge_review_rejection_fix.sql`
- `backend/src/modules/ai-agent/dto/review-knowledge.dto.ts`
- `backend/src/modules/ai-agent/knowledge.service.ts`
- `backend/src/modules/ai-agent/feedback.service.ts`
- `backend/src/modules/ai-agent/ai-agent-orchestrator.service.ts`
- `backend/src/modules/ai-agent/agent-grounding.ts`
- `backend/src/modules/ai-agent/plot-recommendation.service.ts`
- `backend/src/modules/ai-agent/prompts/cemetery-agent.system-prompt.ts`
- targeted backend tests updated/added.

Frontend:
- `frontend/src/pages/admin/ai-agent/AgentAdminPage.tsx`
- `frontend/src/pages/admin/ai-agent/AgentAdminPage.test.tsx`
- `frontend/src/pages/customer/ai-agent/RecommendationCard.tsx`
- `frontend/src/pages/customer/ai-agent/RecommendationCard.test.tsx`

## 5. Deployment/test checklist

1. Deploy backend with automatic DB migrations enabled, or run the migration command so migration `031` is applied.
2. In Admin -> Kiểm duyệt tri thức, reject one quarantined entry **without entering a reason**. It should become `rejected` and disappear from the pending queue.
3. Approve another entry without a note. It should be blocked. Enter >=5 chars and approve; it should become `active`.
4. Confirm rejected/quarantined entries never appear in the active RAG knowledge context.
5. Simulate an approved feedback correction whose knowledge write fails; verify the feedback returns to `pending` for retry.
6. Ask the agent for 3 plot suggestions with enough criteria. Verify the chat answer is a long LLM comparison covering every returned option rather than the old deterministic template.
7. Simulate provider failure. Verify the plot search still returns the deterministic fallback instead of an outage message.
8. Verify the LLM never invents plot codes or claims an `available` plot is already reserved/ready for deposit.

## 6. Verification note

The modified TypeScript/TSX files were syntax-transpiled successfully with TypeScript. Full Jest/Vitest/build execution could not be completed in the sandbox because dependency installation failed at the package registry (`yoctocolors-cjs` returned HTTP 404). Run the repository's normal `npm ci`, backend tests/build, and frontend tests/build in the project environment before production deployment.
