# Improve AI customer consultation depth

## Goal
Make the customer-facing AI advisor conduct a genuine consultation: gather missing needs, explain every recommended plot with concrete tradeoffs and evidence, compare alternatives, and end with a useful follow-up question instead of returning shallow one-line recommendations.

## Phases
- [completed] Trace the customer chat request from frontend through backend/ML prompts, recommendation selection, response shaping, and memory.
- [completed] Reproduce the shallow behavior and identify the exact policy/prompt/data bottleneck.
- [completed] Implement the smallest robust dialogue and recommendation-analysis changes without fabricating plot facts.
- [completed] Add regression tests for follow-up questions, per-plot analysis, comparisons, and incomplete customer profiles.
- [completed] Run relevant AI/backend/frontend validation and document behavior changes.

## Constraints
- Preserve existing routes, request/response contracts, authorization, and admin learning-journal behavior unless a contract change is strictly necessary.
- Ground all plot analysis in real retrieved fields; never invent distance, feng shui, availability, price, or suitability.
- Ask only high-value follow-up questions and avoid interrogating the customer with a long questionnaire.
- Keep Vietnamese natural, empathetic, and concise enough for chat while still substantive.
- Preserve unrelated dirty-worktree changes.

## Errors
| Error | Attempt | Resolution |
|---|---:|---|
| Ripgrep Windows path used a `*.spec.ts` glob as a literal path and failed | 1 | Use `rg -g "*.spec.ts" pattern backend/src/modules/ai-agent` for bounded spec searches. |
| First regression run failed two new assertions: one browse option had only two fit reasons, and the valid comparison was slightly below the initial 120-word validator floor | 1 | Add always-grounded zone/area/direction facts to every option and use a 100-word floor alongside the stronger all-options/trade-off/recommendation/question checks. |
| Second regression run showed the same two assertions | 2 | Root causes were the ASCII semantics of `\b` around Vietnamese recommendation phrases and an overly incidental summary-character-count assertion. Remove word-boundary wrappers and assert summary structure/content instead of raw character length. |
| Third regression run left only the per-option trade-off assertion failing | 3 | The strongest browse option could genuinely be both cheapest and largest with verified access, leaving no generated trade-off. Treat unconfirmed zone/direction preferences as consultation gaps and always add a grounded map/availability verification step when no comparative disadvantage exists. |
| Backend changed-file ESLint reported 87 Prettier violations, primarily repository-required CRLF line endings plus four layout rules | 1 | Run Prettier only on the six changed backend TypeScript files, then rerun ESLint and tests. |
