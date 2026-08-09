# AI Agent + Booking UI Fix Notes — 2026-08-09

This patch is applied directly to the complete backend + React frontend project and targets the seven regressions reproduced from the supplied screenshots.

## 1. FAQ feedback no longer triggers plot recommendation

- Editorial/customer teaching phrases such as `FAQ nên ghi...`, `FAQ nên thêm...`, `FAQ cần ghi...` are handled as knowledge candidates for admin review instead of plot-search requests.
- Recommendation alternatives are selected with diversity signals (direction, price, area, zone, access distance and map row) instead of returning three nearly identical neighboring plots when inventory allows better alternatives.
- When a customer asks for more/different options in the same conversation, recently displayed plot ids are excluded from the next recommendation run.

## 2. Duplicate conversations are protected on both client and server

- `POST /ai-agent/chat` accepts a stable `clientRequestId`.
- The frontend generates one id per send action and uses a synchronous in-flight lock so rapid double submit cannot create two requests before React state updates.
- A first-message retry derives the same session from `clientRequestId`.
- A completed retry replays the stored assistant response instead of running tools/actions again.
- Conversation history also hides near-simultaneous exact duplicate summaries as a compatibility fallback.

## 3. Personal-budget questions answer the question first

- Questions such as `ngân sách t là bao nhiêu?` are answered from the authenticated user's active preference memory.
- The assistant does not automatically search plots.
- It offers an explicit follow-up action to use the remembered budget for recommendations only if the customer wants that next step.

## 4. Bazi/spiritual continuation is more capable and the UI shows the real analysis

- Short birth-time replies such as `11h35p`, `11h35`, `11:35` are understood in an active Bazi flow.
- Backend analysis explains Can Chi year, Nạp Âm, Cung Mệnh/Bát Trạch, favorable directions with stars/meaning, directions to limit, Five-Element relations, and practical use as a soft criterion.
- The response clearly states the current rule calculation is not a full Four Pillars chart when full stem/branch calculation is unavailable.
- The frontend Bazi card now renders the detailed analysis, structured mệnh information, good/bad direction cards and element relations instead of showing mainly the compass.
- Follow-up choices are explicit: filter plots by the analyzed directions, explain the directions further, or return to practical criteria. Plot filtering starts only after the user chooses it.

## 5. Service flow is now inline payment -> scheduling calendar

- The duplicate right-side service catalogue is removed from the AI workflow.
- Service suggestions remain inside the chat where the customer can click `Đặt dịch vụ`.
- After the customer confirms the order, backend returns `SHOW_INLINE_SERVICE_PAYMENT`.
- The React chat renders a compact payment card directly below that assistant message.
- Only after payment is reported does the right panel open with `OPEN_SERVICE_SCHEDULE_CALENDAR`.
- The scheduling panel loads the exact order, lets the customer choose a date, highlights the selected date, and persists it through `PATCH /service-orders/:id/requested-date`.
- The side panel no longer mixes payment/service catalogue content with scheduling.

## 6. Explicit service booking is routed into the booking workflow

- `Mình muốn đặt dịch vụ Thắp hương.` is deterministically routed to `prepare_service_order`.
- The named service is resolved before asking questions.
- The agent asks only for missing operational data (for example, which owned plot if the user has several), then asks for confirmation before creating the order.

## 7. Exact plot request by code is routed into the plot-request workflow

- `Mình muốn đặt yêu cầu cho phương án A-02-003.` resolves the plot code and enters `prepare_plot_request` instead of falling back to a generic misunderstanding reply.
- If reserve-vs-purchase is missing, the agent asks only that choice and preserves the already selected plot.
- Availability is revalidated before the request is created.

## Main frontend files changed

- `frontend/src/pages/customer/ai-agent/AgentPage.tsx`
- `frontend/src/pages/customer/ai-agent/AgentMessage.tsx`
- `frontend/src/pages/customer/ai-agent/InlineServicePaymentCard.tsx`
- `frontend/src/pages/customer/ai-agent/InlineServicePaymentCard.css`
- `frontend/src/pages/customer/ai-agent/AgentWorkflowPanel.tsx`
- `frontend/src/pages/customer/ai-agent/AgentWorkflowPanel.css`
- `frontend/src/pages/customer/ai-agent/agent.types.ts`
- `frontend/src/pages/customer/ai-agent/AgentWorkflowPanel.test.tsx`

## Validation performed in the sandbox

- TypeScript syntax transpilation passed for all AI-agent frontend `.ts/.tsx` files and the changed backend files using TypeScript 5.8.3.
- A full `npm ci` / Vitest / Nest build could not run because the configured package mirror returned HTTP 404 for `zwitch-2.0.4.tgz`. No partial `node_modules` directory is included in the deliverable.
