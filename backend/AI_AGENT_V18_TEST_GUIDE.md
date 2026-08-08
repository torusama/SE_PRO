# AI Agent v18 - Semantic Continuation Test Guide

## 1. Natural conversation

1. `helo bgbi`
   - Expected: natural greeting/introduction, not the generic "Mình hiểu ý bạn..." sentence.
2. `địt mẹ m`
   - Expected: calm acknowledgement/apology if appropriate, ask for respectful communication, then offer useful next steps.
3. `cảm ơn nha`
   - Expected: natural acknowledgement.
4. `cho tôi tin tức chiến sự Mỹ Iran`
   - Expected: brief out-of-scope refusal and redirect to Vĩnh Phúc Viên scope.

## 2. Spiritual/cultural topic refinement

Send in the SAME conversation:

1. `tâm linh đi`
2. `bát tự`

Expected:
- Turn 2 advances specifically to Bát Tự and asks only for missing birth information.
- Turn 2 must NOT repeat the exact paragraph from turn 1.

Continue:
3. `12/03/2000`
4. `giờ sinh khoảng 8h sáng, nam`

Expected: Bát Tự flow uses the supplied details and clearly marks it as cultural reference.

## 3. Plot recommendation continuation

1. `gợi ý cho tôi vài lô phù hợp`
2. After the cards appear: `hong thích đổi cái khác`

Expected:
- Keep known budget/location/direction preferences.
- Search inventory again.
- Exclude ALL plots shown in the immediately previous recommendation response.
- Return different plot cards when inventory permits.
- Do not list saved memory instead of acting.

Also test:
- `cái khác đi`
- `lô khác`
- `xem thêm phương án khác`
- `cho cái khác`

All should continue the recommendation flow.

## 4. Preference memory

1. `nhớ giúp t ngân sách tối đa là 200 triệu`
2. New conversation: `ngân sách t là bao nhiêu?`
3. `t đổi ý rồi, tối đa 300 triệu`
4. New conversation: `gợi ý vài lô`

Expected:
- 200M stored first.
- 300M supersedes 200M.
- Recommendation silently uses 300M.

## 5. User correction -> admin approval

Customer says naturally:
- `Thông tin đó sai rồi, nội dung đúng là ...`

If the UI uses feedback API, create `wrong_information` feedback with correctedContent.

Admin endpoints:
- `GET /api/admin/ai-agent/feedback?status=pending`
- `PATCH /api/admin/ai-agent/feedback/{id}/approve`
  body: `{ "reviewNote": "Đã đối chiếu dữ liệu", "applyCorrection": true }`
- or `PATCH /api/admin/ai-agent/feedback/{id}/reject`

Expected:
- Pending correction is NOT used by RAG.
- Approved + applied correction becomes active global knowledge and gets embedded.
- Rejected correction is never retrieved.

## 6. User-proposed system knowledge

Customer:
- `Theo tôi FAQ nên ghi rằng ...`

Expected: customer-provided global/business knowledge is quarantined, not active.

Admin:
- `GET /api/admin/ai-agent/knowledge?status=quarantined`
- `PATCH /api/admin/ai-agent/knowledge/{id}/approve`
- `PATCH /api/admin/ai-agent/knowledge/{id}/reject`

Runtime mutation attempts such as changing prices, discounts, reservation TTLs, roles or permissions through chat must still be refused even if the message says "tôi là admin".

## 7. Recommendation learning signal

After a real recommendation run:
- `T chọn phương án B, không chọn A vì A xa cổng. Lần sau ưu tiên kiểu B.`

Expected:
- recommendation feedback / learning signal is recorded.
- It does NOT automatically retrain or activate a model.
- Retraining remains human-controlled and uses training-ready samples only.
