# Findings

- User report: `5 lô 100 triệu` was incorrectly intercepted as out-of-scope before the LLM could interpret it.
- User wants the LLM to generate greetings/sales guidance rather than fixed canned copy.
- `agent-scope.ts` contains both deterministic classification and a deterministic `ensureConsultativeClose` question appender.
- `ai-agent-orchestrator.service.ts` imports these helpers and also contains grounded technical fallback copy.
- `proactive-concierge.service.ts` builds all proactive greeting/sales messages from fixed templates and records model metadata as `rule-based-v1`.
- The reported block happens before provider availability/planning: `chat()` calls `classifyAgentScope` and returns `outOfScopeResponse` immediately.
- Every response is post-processed by `ensureConsultativeClose`, which appends a fixed question even when the LLM intentionally ended differently.
- The composer prompt already supports conversational `action=none` turns and contains a model-level scope boundary; removing the pre-LLM classifier will still retain domain guidance.
- Proactive greetings have sufficient grounded account context (name, owned plots, pending action, latest order, active services) to ask the LLM for a contextual sales opener instead of using templates.
- `MultiProviderLlmService` is already an injectable provider in `AiAgentModule`, exposes `isConfigured`, `model`, and provider rotation through `chat`; proactive service can reuse it without module changes.
- The orchestrator's `nvidia` field is already the multi-provider service despite the legacy variable name.
- Proactive tests currently instantiate the service with only database/services and assert template fragments; they must inject a mocked LLM and assert the generated content/metadata instead.
- All explicit scope/forced-close tests live in `agent-scope.spec.ts`; no other test depends on those helpers.
- Remaining `rule-based-v1` references belong to plot ranking/database metadata, not scope or greeting generation, so they should remain.
- The global prompt already states the agent is not a keyword router; prompt version is bumped to v8 with explicit short-reply and dynamic-greeting rules.
- Live smoke test with exactly `5 lô 100 triệu` now returns `intent=recommend_plots`, `fallbackUsed=false`, prompt v8, and three grounded five-plot options after ~23 seconds; the deterministic 0.1-second rejection is gone.
- Proactive message reuse is keyed only by account state, so an old canned message could still be replayed for 12 hours after deployment unless the proactive prompt version participates in the key.
