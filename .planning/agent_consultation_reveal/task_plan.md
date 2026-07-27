# Agent consultation and progressive map reveal

## Goal

Make the cemetery concierge feel like a capable consultant: gather missing needs, explain recommendations clearly, reveal text at a readable pace, then progressively open a straight map and plot details instead of showing everything instantly.

## Phases

- [completed] Inspect the planner/narration prompts, response metadata, chat rendering, contextual map state, and SVG transforms.
- [completed] Strengthen the agent prompt and response contract for consultative, contextual recommendations.
- [completed] Implement paced text rendering and staged map/plot reveal driven by the assistant response.
- [completed] Correct the map orientation and simplify the selected-plot presentation.
- [completed] Add/update tests, lint, build, restart services, and perform a live smoke check.
- [completed] Change vague recommendation requests into conversational discovery before search.
- [completed] Repair multi-layer mojibake in authoritative tool context and final assistant Markdown.
- [completed] Add regression tests, rebuild, restart, and verify the exact user phrase.
- [completed] Keep the composer fully inside the visible workspace at desktop viewport heights.
- [completed] Add an always-visible contextual-map close control and verify responsive behavior.
- [completed] Run focused UI tests/lint/build and verify live services.

## Constraints

- Preserve the current dark teal/gold visual identity.
- Keep conversation and recommendation data sourced from the backend/database.
- Do not fake plot facts in frontend animations.
- Do not require the user to press an extra “introduce” button.
- Do not regress stop-generation, edit/resend, copy, chat history, or map interactions.
- Keep normal chat as one vertically scrolling conversation.

## Decisions

- The AI decides whether it has enough information to recommend; vague requests such as “giới thiệu đi” should ask one focused discovery question before search.
- A recommendation response should include a short empathetic transition, selection rationale, concrete plot facts, trade-offs, and a useful next question.
- The frontend will stage presentation only; backend structured recommendation metadata remains authoritative.
- Explicit “pick any plot / no need to ask” instructions may browse immediately; otherwise exploratory recommendation requests require at least budget and plot count from the current conversation.
- Fresh assistant messages reveal at roughly 94 characters per second; restored history renders immediately.
- Recommendation cards appear only after the assistant narration completes, and the contextual map opens shortly afterward.
- The contextual map is fixed north-up; zoom, pan, reset, and plot selection remain available.

## Errors

- An initial assumption that source strings were mojibake was caused by PowerShell 5.1 reading UTF-8 without `-Encoding UTF8`; file bytes were valid. Subsequent inspection uses explicit UTF-8.
- The first frontend lint run rejected assigning a callback ref during render. The callback ref is now synchronized in an effect; lint and build pass.
- Live delegated-choice testing exposed an unsupported Bazi/deposit-readiness claim. Prompt rules and grounding now reject those claims when authoritative output does not support them.
