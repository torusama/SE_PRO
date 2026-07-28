# Agent sales consultation and map UX

## Goal
Make plot consultation accurate, detailed, beginner-friendly, and data-grounded while improving the opened map panel, comparison flow, and directions affordance.

## Phases
- [complete] Trace prompt, grounded plot data, map panel, and comparison interaction.
- [complete] Improve agent prompt and response grounding to avoid meaningless coordinates and unsupported gate/location claims.
- [complete] Enrich and resize map plot details, add directions, and repair comparison-selection messaging.
- [complete] Run focused tests, lint/build, restart services, and smoke-test.

## Guardrails
- Do not invent market prices, gate coordinates, distance, or amenities absent from the database.
- Explain known data and uncertainty in plain language without asking customers to perform technical map reasoning.
- Keep deterministic database availability/status checks and action authorization.
- Preserve the existing visual identity and responsive chat/map layout.

## Errors Encountered
- context-mode runtime tools were not exposed in this session; use compact direct commands and summarize outputs.
- A combined PowerShell `rg` command had an unterminated quoted pattern. Resolution: split source reads and search into separate commands with single-quoted patterns.
- A follow-up `rg` alternation mixed an escaped quote with Windows paths and produced an invalid regex. Resolution: use separate fixed-string searches (`rg -F`) instead of a composite regex.
- A combined multi-file patch failed because the planner-prompt line did not match its rendered UTF-8 context. Resolution: split structural TypeScript edits from the prompt-string edit and patch the prompt with narrower ASCII context.
- Frontend build found one now-unused `currentRecommendations` memo after removing the compare hint and duplicate `rowCode`/`plotNumber` assignments after spreading map coordinates. Resolution: remove the unused memo and spread coordinates before the enriched field overrides.
- Live smoke testing showed database `mapX/mapY` values use a legacy/admin coordinate scale while the customer map derives geometry from plot codes and zone layout. Resolution: do not use raw DB geometry for entrance ranking; calculate access from the same canonical zone layout as the customer map.
- A read-only `rg` lookup included an invalid Windows wildcard path (`backend\config*`) after already finding the needed config file. Resolution: use the exact `backend/src/config/env.config.ts` path; no implementation impact.
