# AI Agent Learning, Booking & Payment Flow Review

## Scope

This review covers the customer AI Agent backend/frontend flow after the knowledge-review fixes, with emphasis on:

- safe application-level learning and RAG;
- plot recommendation feedback signals;
- management appointment booking;
- cemetery-service order/payment/scheduling;
- exact deep links from the AI side panel to customer pages;
- UI focus/transition behavior.

## 1. Safe learning changes

### Explicit personal preferences

One customer message can now recover multiple durable preferences instead of collapsing the whole sentence into one memory key. For example, a sentence that explicitly asks the agent to remember a maximum budget, zone, direction and near-gate preference can persist those fields independently.

These remain user-scoped memories. They do not modify global Knowledge Base facts.

### Recommendation-card behavior signal

A real click on **Đặt yêu cầu** is recorded as recommendation feedback using the exact `recommendationRunId` of the assistant message that rendered that card when available. This is stronger and safer than asking the planner LLM to guess which historical recommendation the user selected.

A single click is stored as behavioral analytics only. It does **not** automatically become a durable inferred preference and does **not** retrain/deploy a model.


### Training-signal bridge

Complete pairwise recommendation feedback (an actual recommendation run with both a selected and a rejected option plus the stored feature snapshot) can now become PlotRanker training rows. The conversion happens only when an authenticated administrator explicitly starts retraining. Each complete signal becomes one positive sample for the selected option and one negative sample for the rejected option. The chat path itself still does not retrain or deploy anything, and candidate deployment remains an explicit administrator action after the metric gate.

### RAG reliability

- Embedding keys fall back to the configured NVIDIA API key pool when dedicated embedding keys are not present.
- Startup embedding backfill drains multiple small batches instead of processing only five missing entries once.
- The startup cap is configurable with `AI_RAG_BACKFILL_MAX_ENTRIES`.
- Embedding passages include knowledge type, memory key, category, title and content, giving retrieval more semantic context than embedding content alone.

## 2. Management appointment flow

Expected flow:

1. Customer asks the AI to schedule a meeting with management.
2. Backend returns `OPEN_APPOINTMENT_CALENDAR` in `collecting` mode if date/time is incomplete.
3. The right-side AI workflow panel opens an interactive calendar plus start/end time and topic fields.
4. The panel sends the selected values back through the agent, so conversation memory and the pending action stay consistent.
5. Backend returns the same panel in `review` mode with the exact date/time/topic.
6. Customer explicitly clicks **Xác nhận đặt lịch**.
7. Only then does the backend create the appointment request.
8. Backend returns `summary` mode with the real appointment ID.
9. **Xem lịch hẹn của tôi** deep-links to `/lich-hen?appointment=<id>`.
10. The appointments page clears restrictive filters, scrolls the exact appointment into view, and gives it a short focus highlight.

If the selected slot conflicts with another management appointment, the backend returns a Vietnamese conflict message and keeps `OPEN_APPOINTMENT_CALENDAR` active with the user's current values. The customer can change the slot without restarting the flow.

## 3. Service order -> payment -> schedule flow

Expected flow:

1. Customer chooses a service through the AI.
2. Agent collects required service/plot/date details and asks for explicit confirmation.
3. Backend creates the service order only after confirmation.
4. Backend returns `SHOW_INLINE_SERVICE_PAYMENT`.
5. The right-side panel shows the exact service order, plot, requested date, amount and demo transfer code.
6. Customer clicks **Tôi đã chuyển khoản** to report that the demo transfer was made.
7. Backend changes payment status to `awaiting_confirmation` and notifies administrators.
8. The panel advances to `OPEN_SERVICE_SCHEDULE_CALENDAR` without closing/reopening a separate page.
9. Customer can keep or change the requested service date.
10. **Xem đơn dịch vụ của tôi** deep-links to `/dich-vu?tab=track&order=<id>`.
11. The service page switches to tracking, expands the exact order, loads its detail, scrolls it into view and gives it a short focus highlight.

Important: the current payment step is an MVP/demo transfer-report flow, not a real payment gateway. A customer click means "payment reported"; the administrator still verifies the real payment afterward.

## 4. UI motion and focus

The agent workflow panel intentionally uses subtle motion rather than a large zoom:

- side panel: short slide/fade with a very small scale-in;
- panel content: short vertical fade when payment/calendar/review stages change;
- current step: one short focus pulse;
- deep-linked service order / appointment: smooth scroll to center plus one short ring/scale focus animation;
- `prefers-reduced-motion` disables these animations.

This keeps the selected task obvious without making a sensitive service/appointment flow visually aggressive.

## 5. Deliberately not automated

The following are intentionally **not** turned on automatically:

- one-click behavior becoming a durable personal preference;
- customer claims becoming global Knowledge Base facts;
- automatic model retraining/deployment from recommendation clicks (training materialization happens only at an explicit admin retrain action, and deployment remains separate);
- self-modification of foundation-model weights.

Those boundaries preserve admin governance for shared facts and avoid teaching the agent a long-term preference from one accidental action.

## 6. Recommended manual regression checks

1. Ask only "Tôi muốn đặt lịch với ban quản lý" -> calendar panel opens and asks for missing date/time.
2. Pick date/start/end/topic in panel -> agent returns review state -> click final confirmation -> appointment is created once.
3. Try a conflicting slot -> same panel remains open with values preserved.
4. Click appointment deep link -> exact appointment is visible and highlighted.
5. Start a service order through AI -> explicit confirmation -> payment panel opens with the new order.
6. Report demo payment -> status becomes awaiting confirmation -> calendar stage opens.
7. Change service date -> refresh order -> date persists.
8. Click service deep link -> tracking tab opens exact order expanded/highlighted.
9. In one message, explicitly ask the agent to remember budget + zone + direction + location -> verify independent user-memory keys.
10. Click **Đặt yêu cầu** on an older recommendation card -> verify the learning signal uses that card's exact recommendation run when metadata is available.
