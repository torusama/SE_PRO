# Agent consulting depth and scope guard

## Goal

Make the concierge give richer, sales-oriented, grounded advice, consistently invite the user into the next useful step, and refuse unrelated requests without blocking legitimate cemetery-adjacent questions.

## Phases

1. [completed] Audit system/planner/narrative prompts, fallback responses, and intent handling.
2. [completed] Implement a deterministic scope classifier with safe redirects and prompt-level scope rules.
3. [completed] Upgrade advisory response structure and contextual follow-up behavior.
4. [completed] Add regression tests for in-scope, adjacent, ambiguous, and out-of-scope requests.
5. [completed] Build, restart servers, and smoke-test.

## Constraints

- Scope includes plot discovery/comparison, cemetery services, purchase/reservation workflow, owned-plot support, maps, pricing, cultural direction/Bazi guidance, and relevant account/order status.
- Polite greetings and short replies that continue an active conversation must remain allowed.
- Refusals should be brief, explain supported capabilities, and end with one useful in-scope question.
- Advice must remain grounded in live tool/database results and never invent availability, prices, or order state.
- Preserve all existing dirty-worktree changes.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Scope test rejected “một lô dưới 150 triệu” because only compound plot phrases were recognized | 1 | Added bounded Vietnamese plot-intent patterns without treating the unrelated word “lo” as a plot. |
