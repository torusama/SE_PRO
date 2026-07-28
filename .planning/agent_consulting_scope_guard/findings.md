# Findings

- User reports that advisory replies are too short and often stop without moving the conversation forward.
- Requested behavior: answer first, then ask one context-aware next question; refuse requests outside the concierge's supported domain.
- The v6 system prompt currently says ordinary follow-ups should be concise and explicitly says not to end every response with a question. This conflicts with the requested guided-consultation behavior.
- The response composer already has richer instructions for deep consultation and recommendations, but only the deep-consultation branch mandates a follow-up question.
- There is no deterministic domain scope check before the planner/LLM calls. Out-of-scope input can currently be classified as `general_question` and answered conversationally.
- The chat method loads history and pending action before the planner, so scope classification can safely allow short contextual replies and active booking continuations while blocking unrelated fresh requests.
- Deterministic recommendation fallbacks already contain comparisons and a concrete closing choice; the weaker paths are ordinary LLM conversation, service/process fallbacks, and generic failure responses.
- `agent-planner.ts` already exports `isEnglishText`, which can be reused for bilingual scope refusals instead of introducing a second language detector.
- Service fallback previously returned only a semicolon-separated name/price list. It now needs descriptions, a cost-oriented recommendation, booking safeguards, and a concrete choice.
- Mixed requests remain in scope only when they contain a real supported cemetery intent; the composer is instructed to answer that portion and decline the unrelated portion.
