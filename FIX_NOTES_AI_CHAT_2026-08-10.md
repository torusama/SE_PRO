# AI Chat Fix Notes – 2026-08-10

## Updated areas
- Fixed spiritual/Bát Tự conversation routing priority.
- Added quick-reply chips for:
  - `Giữ chỗ tạm thời`
  - `Gửi yêu cầu mua lô`
  - owned plot selection when ordering a service.
- Added automatic follow-up suggestion chips after assistant answers.
- Improved service-order continuation so a bare plot code can continue the current service booking flow.
- Improved recommendation count parsing for requests such as `vài lô`, `một vài lô`, `mấy lô`.
- Added richer post-request follow-up suggestions.
- Added animated three-dot thinking indicator in comparison assessment bubble.
- Kept/used stop-response UI behavior on the frontend.

## Main changed files
- `backend/src/modules/ai-agent/ai-agent-orchestrator.service.ts`
- `backend/src/modules/ai-agent/agent-booking.service.ts`
- `frontend/src/pages/customer/ai-agent/AgentMessage.tsx`
- `frontend/src/pages/customer/ai-agent/ComparisonAssessmentMessage.tsx`
- `frontend/src/pages/customer/ai-agent/AgentPage.css`
