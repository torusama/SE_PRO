# AI Agent — kiểm thử hội thoại thật và bản sửa ổn định

Tài liệu này ghi lại đợt kiểm thử live ngày 23/08/2026 cho AI Agent Vĩnh Phúc Viên. Mục tiêu không phải chỉ gọi endpoint, mà nói chuyện như người dùng thật: câu vu vơ, tiếng Việt đời thường, tự sửa dữ kiện, nhiều yêu cầu trong một câu, nối ngữ cảnh nhiều lượt, Bát Trạch/Bát Tự, tìm lô, dịch vụ, quy trình mua và prompt injection.

## Kết luận

- Bộ hội thoại người thật gần nhất: **12/12 lượt đạt**.
- Sau các chỉnh sửa cuối, hai chuỗi rủi ro cao được chạy riêng lại và đạt: **Bát Tự → chọn lô → chốt lô: 3/3**; **sửa năm sinh + ngày/giờ vô hiệu: 2/2**.
- Build NestJS: **đạt**.
- Regression chọn lọc: **74/74 test module đạt** và **8/8 test helper trọng tâm đạt**.
- Bộ API 68 ca sau bản sửa cuối (chạy không có credential test): **62 đạt, 5 fail, 1 gap — 91,2% pass**. Cả 5 fail đều là các ca client/admin không thể xác thực vì credential test không được truyền; toàn bộ 62 ca chat/workflow/security/robustness còn lại đạt. Báo cáo chi tiết nằm tại [AI_AGENT_TEST_RESULTS.md](./AI_AGENT_TEST_RESULTS.md).

## Kiến trúc quyết định sau khi sửa

Luồng bình thường hiện là:

1. LLM planner bắt buộc trả một chỉ thị có cấu trúc hoặc một câu trả lời trực tiếp không rỗng.
2. Backend kiểm tra chỉ thị và hợp nhất các dữ kiện cấu trúc chắc chắn từ câu hiện tại, ví dụ mã lô, năm sinh đã sửa, `2 lô sát nhau`, ngày và giờ.
3. Chỉ sau khi chỉ thị hợp lệ, tool/DB mới đọc dữ liệu hoặc chuẩn bị workflow.
4. LLM composer viết phần tư vấn từ kết quả đã xác minh.
5. Nếu composer im lặng, timeout hoặc viết sai grounding, hệ thống trả template dữ liệu chuẩn và ghi rõ `RECOMMENDATION_NARRATIVE_FALLBACK`; không vứt kết quả tool để trả một lỗi chung.
6. Mọi side effect vẫn cần đăng nhập/xác nhận; câu chat không thể tự mua lô, thanh toán, nâng quyền hoặc đổi trạng thái DB.

Điểm quan trọng: template fallback chỉ chạy sau khi planner LLM đã đưa ra chỉ thị hợp lệ. Nó bảo đảm người dùng luôn nhận được câu trả lời, nhưng không cấp cho regex/template quyền tự ý chọn tool hoặc tạo giao dịch.

## Lỗi đã tìm thấy và đã sửa

### Model và timeout

- Probe trực tiếp `openai/gpt-oss-120b` với prompt ngắn bốn câu, low reasoning và deadline 45 giây vẫn không có final response. Đây là lỗi/độ ổn định của route bên ngoài, không chỉ do prompt hội thoại dài.
- Main chat và final composer chuyển sang ưu tiên route `openai/gpt-oss-20b` đã chứng minh có phản hồi. Nemotron là failover kế tiếp; 120B được giữ làm fallback cuối.
- Summary/learning chạy nền dùng pool secondary riêng để không chiếm deadline của planner chính.
- Empty response, chỉ có reasoning, JSON sai, timeout và response không đạt validator đều bị xem là provider failure; không được tính là một câu trả lời thành công.

### Hiểu câu nhiều ý và nhớ ngữ cảnh

- Giữ đúng `numberOfPlots=2` và `needAdjacent=true` cho câu “cần 2 lô nằm sát nhau; cho 3 phương án”. Số lô cần mua không còn bị nhầm với số card muốn xem.
- Giữ budget, gần cổng và tính liền kề khi người dùng chỉ bỏ điều kiện hướng ở lượt sau.
- Chuẩn hóa `tầm 7 giờ sáng` thành `07:00`, `7 giờ tối` thành `19:00`.
- Câu “sinh năm 2000, à nhầm 2001” lấy **2001** làm dữ kiện cuối. Composer Bát Trạch bắt buộc nhắc đúng năm và đúng Can Chi từ tool.
- Câu “khoan/chưa/đừng tìm lô” chỉ chạy phân tích hướng, không tự nối sang inventory cũ.
- `lau dọn` được ánh xạ đúng sang dịch vụ dọn dẹp mộ; một câu có nhiều dịch vụ giữ đủ từng dịch vụ.

### Regression 23/08 — tư vấn lô theo đúng yêu cầu và tốc độ

- Lỗi live: câu đầu yêu cầu Bát Tự để chọn lô, đồng thời nói “gần cổng, thoáng mát”; sau khi trợ lý hỏi giới tính, lượt trả lời ngắn chỉ còn dữ liệu sinh và làm rơi hai tiêu chí chọn lô. Kết quả cũ chọn ba lô hướng Nam nhưng đều nằm sâu hơn cổng.
- Planner prompt nay duy trì một **active request ledger**: câu hỏi làm rõ chỉ bổ sung một ô còn thiếu, không thay thế ngân sách/khu/hướng/diện tích/gần cổng hay mong muốn thực tế đã nêu.
- Backend giữ lại các requirements đã xác nhận qua lượt clarification. Biến thể gõ nhầm rõ nghĩa như `aganf cổng` vẫn được giữ thành `preferNearEntrance=true`, nhưng không dùng từ khóa này để tự quyết định intent/tool.
- Mong muốn chưa có trường dữ liệu như “thoáng mát”, “yên tĩnh”, “có cây xanh” được giữ trong `qualitativePreferences`. Câu trả lời phải nói chưa xác thực được và đề nghị xem bản đồ/ảnh hoặc nhờ nhân viên xác nhận, không tự suy ra từ khu/hướng.

### Regression 23/08 — bộ nhớ hội thoại và học tập

- Bộ nhớ trong conversation được ghi ngay bằng snapshot xác định từ backend; một lượt tiếp nối giữ lại toàn bộ active-request ledger, không chỉ riêng lượt trả lời câu hỏi làm rõ. Live test giữ đúng `preferredDirection=Tây Bắc`, `preferNearEntrance=true` và `qualitativePreferences=["thoáng mát"]` qua lượt hỏi tiếp.
- Người dùng đăng nhập có bộ nhớ dài hạn giữa các session. Live test ở session mới đọc đúng ngân sách tối đa 200 triệu đã lưu trước đó. Khách ẩn danh chỉ nhớ trong session hiện tại và không có memory dài hạn theo tài khoản.
- Khi hỏi về một cuộc trò chuyện trước, planner phải giữ provenance: chỉ dùng summary/history của conversation đó. Sở thích dài hạn hoặc hồ sơ tài khoản không được kể như thể đã xuất hiện trong conversation. Live test chỉ nhắc lại đúng `Tây Bắc + gần cổng + thoáng mát`, không trộn preference `yên tĩnh` từ nguồn khác.
- Dữ liệu cũ cho thấy từng có memory sai khóa (`preferred_direction` nhưng nội dung là đặt dịch vụ Thắp hương) và yêu cầu một lần (`dịch vụ ngày mai`) bị lưu dài hạn. Backend nay kiểm tra nội dung tương thích với `memoryKey`, yêu cầu bằng chứng về tính lâu dài, và bỏ qua record cũ không hợp lệ khi đọc mà không xóa lịch sử/audit.
- Semantic conversation summary và learning reflection trước đây bị ép qua `openai/gpt-oss-120b` rồi timeout. Hai tác vụ nền nay dùng primary 20B, không chặn HTTP; live DB đã ghi `summary_model=openai/gpt-oss-20b` và `summary_updated_at` thành công. Snapshot xác định vẫn là fallback tức thời nếu summary nền timeout.
- Có 58 journal lesson tự sinh, tất cả mới được quan sát một lần và có record mâu thuẫn. Lesson tự sinh một lần vẫn được giữ cho audit/admin review nhưng không còn đưa vào mọi prompt. Chỉ lesson do admin chỉnh hoặc được quan sát lặp lại từ 2 lần mới trở thành context hành vi.
- Kiểm thử chọn lọc cho memory/planner/learning: 6 suites, 120/120 tests pass; `tsc --noEmit` pass.
- Live retest đúng chuỗi trên giữ đủ ngày sinh, giờ sinh, giới tính, gần cổng và thoáng mát; kết quả là `H-02-005`, `H-01-005`, `H-01-002`, đều hướng Nam và thuộc nhóm gần cổng theo dữ liệu sơ đồ.
- Nếu không có lô khớp toàn bộ bộ lọc, backend thử tìm phương án gần nhất bằng mức nới nhỏ nhất, nêu rõ tiêu chí nào bị nới và từng chênh lệch. Test với Khu Z + Tây Nam + tối đa 1 triệu trả rõ không có exact match và chỉ đề xuất `D-02-001`, `D-01-001`, `F-02-006` như phương án thay thế.
- Composer tư vấn không còn chờ nối tiếp 20B → Nemotron → 120B. Nó chỉ thử primary trong ngân sách 8 giây; nếu prose không đạt grounding thì dùng kết quả backend ngay. Lượt Bát Tự → tìm lô giảm từ khoảng **52 giây xuống 8–12 giây** trong các lần live retest.

### Audit 23/08 — ghi nhận, phân tích và trả lời khách hàng

- Phát hiện backend từng tự đổi chỉ thị LLM `action=none` thành `rank_plot_options`/`browse_available_plots` chỉ vì intent là `recommend_plots`. Vì vậy câu “chỉ ghi nhận các tiêu chí, chưa cần tìm lô” vẫn có thể gọi inventory dù LLM không cấp quyền.
- Đã sửa nguyên tắc permission gate: `action=none` là chỉ thị hoàn chỉnh và được giữ nguyên. Backend chỉ được đổi giữa hai tool tương đương `browse_available_plots` và `rank_plot_options` sau khi LLM đã thực sự cho phép hành động tìm lô; intent một mình không còn cấp quyền gọi tool.
- Semantic prompt v25 có ràng buộc scope/postponement và ví dụ cụ thể: câu yêu cầu chỉ ghi nhận/xác nhận/phân tích nhưng chưa chạy bước tiếp theo phải trả lời trực tiếp, giữ active-request ledger và không gọi tool.
- Live test session `audit-defer-*`: lượt đầu chứa ngân sách 200 triệu + Tây Bắc + gần cổng + thoáng mát + “chưa cần tìm” trả trong **4,31 giây**, **0 recommendation, 0 tool call**. Lượt sau mới nói “giờ tìm 3 phương án” trả trong **10,03 giây**, đúng 3 card và vẫn giữ đủ bốn tiêu chí.
- Đối chiếu DB cho thấy đúng 4 message user/assistant, mỗi cặp có cùng requirements; chỉ lượt thứ hai có một tool call `rank_plot_options` thành công. Gửi lại cùng `clientRequestId` trả bản ghi cũ trong **0,075 giây** (`replayed=true`), không phân tích hay ghi giao dịch lặp.
- Audit dữ liệu 24 giờ: 309 assistant/311 user; không có assistant rỗng, không có assistant thiếu `agentMetadata`, không có conversation đã trả lời nhưng thiếu memory snapshot. Hai user message không có assistant tiếp theo đều là dữ liệu test cũ trong giai đoạn model timeout; 30 phút gần nhất cân bằng 6 user/6 assistant.
- Regression trọng tâm sau sửa: **72/72 test đạt** và `tsc --noEmit` đạt. Full thư mục AI hiện có **34/35 suite đạt, 376/403 test đạt**; 27 assertion còn fail đều tập trung ở `ai-agent-orchestrator.learning.spec.ts` do file này vẫn mock/đòi logic keyword, phương thức context cũ và timeout/model cũ đã bị thay bởi kiến trúc LLM-first. Đây là test debt cần cập nhật, không được che bằng `skip` và không được dùng để đưa keyword router cũ trở lại production.

### Audit 23/08 — admin xét duyệt, ghi nhớ và tự học

- Có ba luồng tách biệt. Tri thức chung do khách/AI đề xuất luôn vào `quarantined` và chỉ thành `active` sau khi admin duyệt. Sở thích dài hạn của người dùng chỉ tự kích hoạt trong scope `user`, đúng chủ tài khoản và sau kiểm tra privacy/key/evidence. Nhật ký tự học một lần chỉ lưu để quan sát; phải lặp lại từ 2 lần hoặc được admin sửa và lưu thì mới đi vào prompt.
- Toàn bộ controller quản trị được bảo vệ bởi JWT và role `admin`. Probe không đăng nhập tới `/api/admin/ai-agent/knowledge` trả **401**. Lần audit không giả mạo token và không thay đổi dữ liệu thật khi chưa có credential admin test.
- Sửa lỗ hổng duyệt kho tri thức chỉ kiểm tra `content` nhưng bỏ qua `title`: nay kiểm tra cả hai trường prompt-facing. Bộ chuẩn hoá cũng xử lý đúng cả `đ` và `Đ`, nên câu viết hoa đầu dòng như “Đổi trạng thái lô…” không còn lọt bộ chặn.
- Sửa đường tắt feedback: `correctedContent` được admin duyệt không còn có thể âm thầm tạo rule đổi giá, giảm giá, trạng thái, quyền hay quy trình giao dịch. Tiêu đề active không sao chép lại câu trả lời cũ đã biết là sai.
- Sửa provenance khi duyệt: giữ lại `validation_evidence` ban đầu rồi bổ sung reviewer/action, thay vì ghi đè mất nguồn. Bộ lọc `sourceRole` nay thực sự được áp dụng ở SQL; status feedback hỗ trợ đủ `pending`, `validating`, `approved`, `rejected`, `applied`.
- Sửa nhật ký tự học: UI không còn gắn nhãn “Đang áp dụng” cho lesson tự sinh mới thấy một lần; hiển thị “Chờ xác nhận lặp lại” và nút admin là “Duyệt và áp dụng”. Nội dung lesson được chặn rule vận hành, che ngày/tiền cùng PII/mã lô, escape ký tự markup trước khi vào prompt. Update/delete lesson và audit log nay nằm trong cùng transaction, không còn trường hợp dữ liệu đổi nhưng lịch sử audit ghi thất bại.
- Snapshot DB sau sửa: global knowledge **7 active + 3 quarantined**; user memory **5 active + 2 rejected + 10 superseded**; journal **58 active record nhưng đều auto-generated, mới quan sát 1 lần nên 0 lesson prompt-active**; feedback **1 pending**; không có knowledge record nào lệch giữa `validation_status` và `is_active`.
- Regression cho learning/admin/backend: **7 suite, 64/64 test đạt** và `tsc --noEmit` đạt. Frontend admin: **8/8 test đạt**, production build đạt. Backend `:5000` và frontend `:5173` đều trả **200** sau build.

### Grounding và tính nhất quán

- Chặn mã lô bịa, số lượng lô/phương án phóng đại, số tiền sai bậc nghìn/triệu, tuyên bố sẵn sàng đặt cọc, lợi ích tâm linh không có dữ liệu và suy diễn sức chứa/vật phẩm từ diện tích.
- Sửa lỗi `29.000.000 VND` bị model viết thành `29.000 VND` khi có đúng một giá trị authoritative tương ứng.
- Chuẩn hóa dấu gạch Unicode trong mã lô trước khi kiểm tra và trước khi trả payload UI.
- Nhóm lô liền kề được map bằng **toàn bộ cặp mã trong heading**, không còn map bằng một mã dùng chung. Heading mơ hồ sẽ dùng trọn bộ template authoritative để phần chữ và card UI không trỏ sang hai phương án khác nhau.
- Follow-up “chốt lô nào” vẫn lấy lựa chọn do LLM nêu, nhưng giá, diện tích, hướng, khoảng cổng, budget còn lại và chênh lệch với lô khác được dựng lại từ payload đã lưu. Nhờ vậy không còn câu kiểu “29 triệu vượt ngân sách 250 triệu” hoặc tự nói một lô gần cổng hơn khi dữ liệu hai lô ngang nhau.
- Lô chính xác `A-01-001` trả đúng trạng thái đã bán và dữ liệu vị trí; nếu cùng câu hỏi quy trình mua, hệ thống nối thêm quy trình authoritative và không tự gửi đơn.

### Validation và an toàn

- Ngày/giờ bất khả thi được kiểm tra sau chỉ thị LLM và trước mọi workflow. Ví dụ `31/02 lúc 25 giờ` trả rõ cả hai lỗi.
- Planner trả văn bản không cấu trúc được hạ thành `action=none`; nó có thể trả lời nhưng không được cấp quyền gọi tool hay tạo side effect.
- Prompt injection yêu cầu in system prompt/API key hoặc tự nâng admin bị chặn tại local safety boundary.
- Credential từng bị hardcode trong full-test script đã bị xóa. Muốn chạy test xác thực phải truyền bằng biến môi trường; report không ghi email/mật khẩu.

## Cách chạy lại

Khởi động backend ở cổng 5000 rồi chạy trong thư mục `backend`:

```powershell
npm run build
npm run test:ai:human
npm run test:ai:full
npm run probe:ai:120b
```

Chạy riêng một scenario hội thoại:

```powershell
$env:AI_TEST_SCENARIO='HUMAN-BAZI-TO-PLOT'
npm run test:ai:human
```

Full suite không chứa tài khoản mặc định. Khi cần kiểm tra endpoint có xác thực, đặt tạm các biến sau trong terminal hiện tại:

```powershell
$env:AI_TEST_CLIENT_EMAIL='...'
$env:AI_TEST_CLIENT_PASSWORD='...'
$env:AI_TEST_ADMIN_EMAIL='...'
$env:AI_TEST_ADMIN_PASSWORD='...'
npm run test:ai:full
```

## Phần còn phụ thuộc bên ngoài

- Route `openai/gpt-oss-120b` vẫn timeout/không trả final text trong probe live. Code đã cô lập và failover được, nhưng không thể sửa độ sẵn sàng của endpoint từ repository này.
- Năm ca client/admin còn fail của full suite cần credential test hợp lệ mới xác minh được HTTP 403 và nội dung các API knowledge/proposal/journal/analytics; đây là giới hạn của lần chạy không credential, không phải kết luận các endpoint bị hỏng.
- Fine-grained memory reset (“chỉ quên budget, giữ sở thích khác”) vẫn được full suite đánh dấu **GAP**; reset toàn bộ memory có confirmation đã hoạt động.
