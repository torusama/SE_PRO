# Agent LLM autonomy

## Goal
Remove deterministic scope blocking and canned sales/greeting responses so the LLM handles natural-language intent, domain boundaries, greetings, consultation, and follow-up questions with full conversation and cemetery context.

## Phases
- [complete] Trace deterministic scope checks and canned response paths.
- [complete] Route normal messages and greetings through the LLM while retaining only technical outage safety.
- [complete] Update focused tests, build, restart, and smoke-test the reported phrase.

## Guardrails
- Keep tool authorization, database validation, and transactional safety deterministic.
- Do not remove technical fallbacks needed when every LLM provider is unavailable.
- Preserve conversation history and current cemetery/business context.

## Errors Encountered
- Combined orchestrator/prompt/helper deletion patch missed the UTF-8 prompt line context. Resolution: split structural edits from prompt edits and match the source's proper Vietnamese text.
- ESLint reported 148 Prettier-only CRLF insertions in the two proactive files after patching on Windows. Resolution: run project Prettier on the edited TypeScript files, then rerun checks.
