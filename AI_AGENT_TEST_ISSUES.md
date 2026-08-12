# AI Agent — lỗi phát hiện khi test thật

Ngày test: 11/08/2026. Test bằng tài khoản customer thật, API `POST /api/ai-agent/chat` và session mới cho từng case.

## Trạng thái sau khi sửa

Đã sửa và retest live ngày 11/08/2026: **9/9 lỗi bên dưới không còn tái hiện**. Các câu chức năng rõ ràng hiện đi qua plan/tool có dữ liệu xác thực; đặt lịch/dịch vụ/nhắc giỗ dùng state-machine template; câu mở về Bát Tự bắt buộc intake trước; provider lỗi vẫn có câu trả lời local hữu ích. Regression module AI: **323/323 test pass**.

## 1. Câu hỏi quy trình mua bị chuyển thành gợi ý lô

- Câu gửi: `Quy trình mua một lô đất nghĩa trang gồm những bước nào, cần chuẩn bị gì?`
- Kết quả thực tế: agent trả intent `recommend_plots` và tự đề xuất 3 lô theo ngân sách/Khu A đã lưu.
- Kỳ vọng: intent `purchase_process`, giải thích các bước mua và hồ sơ cần chuẩn bị; không tìm hay đề xuất lô khi khách chưa yêu cầu.
- Ảnh hưởng: câu hỏi thông tin đơn giản bị dùng nhầm preference cũ và dẫn sang luồng mua lô.

## 2. Câu hỏi dịch vụ cho lô đã sở hữu bị chuyển thành gợi ý lô trống

- Câu gửi: `Lô của mình có thể dùng các dịch vụ chăm sóc nào và chi phí ra sao?`
- Kết quả thực tế: agent trả intent `recommend_plots` và đề xuất 3 lô trống thay vì danh mục dịch vụ.
- Kỳ vọng: intent `customer_care` hoặc `service_suggestions`, đối chiếu các lô khách đang sở hữu rồi trả dịch vụ/chi phí phù hợp.
- Ảnh hưởng: khách hỏi hậu mãi nhưng bị tư vấn mua thêm lô; đặc biệt dễ xảy ra khi vòng gọi model bị fallback.

## 3. Hỏi thông tin/độ phù hợp của mã lô đã mua bị hiểu là tạo yêu cầu mua lô

- Câu gửi: `Cho mình xem kỹ thông tin và mức độ phù hợp của lô A-01-001.`
- Kết quả thực tế: agent trả intent `plot_request`, báo lô đã mua nên không thể tạo yêu cầu, rồi đề xuất lô khác.
- Kỳ vọng: intent `plot_details` hoặc `plot_competitiveness`, trả dữ liệu và nhận xét về đúng lô A-01-001; không khởi tạo luồng yêu cầu mua.
- Ảnh hưởng: không thể hỏi chi tiết về lô đã sở hữu bằng ngôn ngữ tự nhiên.

## 4. Hỏi giá đúng mã lô bị fallback sang gợi ý lô khác

- Câu gửi: `Giá lô A-01-001 bao nhiêu?`
- Kết quả thực tế: sau khoảng 24 giây, agent fallback và đề xuất ba lô trống `A-02-005`, `A-02-001`, `A-02-003` theo ngân sách/Khu A đã lưu, kèm các nút tạo yêu cầu mua.
- Kỳ vọng: trả giá hoặc thông báo rõ tình trạng của đúng lô `A-01-001`; không dùng preference cũ để chuyển sang tư vấn lô khác.
- Ảnh hưởng: một câu hỏi định danh rất ngắn bị trả lời sai trọng tâm khi model không phản hồi, dễ khiến khách hiểu nhầm giá/trạng thái lô đang hỏi.

## 5. Luồng đặt dịch vụ trả lời lỗi hệ thống khi provider không phản hồi

- Câu gửi: `tôi muốn đặt dịch vụ chăm sóc mộ`
- Kết quả thực tế: sau khoảng 34 giây, agent trả: `Mình chưa thể tạo câu trả lời bằng mô hình AI sau khi đã thử các kênh đang cấu hình... bạn thử gửi lại câu này sau ít phút nhé.`
- Kỳ vọng: đây là câu mẫu/luồng xác định được. Agent phải trả lời tiếp được bằng luồng dịch vụ (hỏi dịch vụ nào hoặc đưa danh sách dịch vụ), dù LLM/provider có timeout.
- Ảnh hưởng: vi phạm yêu cầu luôn có câu trả lời hữu ích; khách không thể bắt đầu đặt dịch vụ đúng lúc provider lỗi.

## 6. Tạo và hủy nhắc giỗ không có fallback chức năng

- Chuỗi test: `Nhắc giỗ ông nội cho mình vào ngày 20/08/2027 lúc 9 giờ sáng.` → `Mình xác nhận nhắc giỗ này.` → `Mình không muốn tạo nữa, hủy giúp mình.`
- Kết quả thực tế: cả ba lượt đều mất khoảng 24 giây rồi trả cùng thông báo không thể tạo câu trả lời vì các kênh AI không phản hồi. Lệnh hủy không được thực hiện.
- Kỳ vọng: luồng nhắc giỗ và đặc biệt lệnh hủy pending action phải có fallback theo rule/template, không phụ thuộc kết quả sinh văn bản của provider.
- Ảnh hưởng: khách không thể hoàn tất hay hủy thao tác đang dở khi provider gián đoạn; rủi ro cao nếu có pending action thực.

## 7. LLM bịa thiếu quỹ lô dù dữ liệu có lô phù hợp

- Câu gửi: `Tư vấn lô đất ngân sách 80 triệu ở Khu A.`
- Kết quả thực tế: model `openai/gpt-oss-120b` trả intent `plot_request` và nói không có lô còn trống ở Khu A dưới 80 triệu, đề nghị tăng ngân sách/mở rộng khu vực. Dữ liệu thật trả từ endpoint đề xuất có các lô Khu A giá 48.000.000 và 49.000.000 VND.
- Kỳ vọng: intent tư vấn/gợi ý lô; lấy danh sách, giá và trạng thái từ tool/RAG đã truy vấn rồi mới cho LLM diễn đạt. Không được để LLM tự kết luận tồn kho.
- Ảnh hưởng: khách bị tư vấn sai hoàn toàn dù hệ thống có phương án đúng trong ngân sách.

## 8. Câu “tuổi Mèo” tự dùng profile cũ, sai con giáp và đề xuất lô quá sớm

- Câu gửi: `t tuổi mèo thì nên chọn lô nào?`
- Kết quả thực tế: agent tự lấy dữ liệu profile/memory cũ, phân tích thành tuổi **Bính Tuất**, dùng ngân sách 200.000.000 VND/Khu A đã lưu và đề xuất ngay 3 lô. Câu trả lời mâu thuẫn trực tiếp với “tuổi Mèo” người dùng vừa nói.
- Kỳ vọng: ở lượt đầu phải hỏi tối thiểu năm sinh/ngày sinh, giới tính, giờ sinh (nếu cần) và tiêu chí/ngân sách; dữ liệu profile chỉ được gợi ý để khách xác nhận, không được âm thầm thay thế thông tin vừa nói. Chỉ đề xuất lô sau khi đủ input.
- Ảnh hưởng: tư vấn Bát tự sai người, lộ/áp preference cũ vào tư vấn mới, và bỏ qua bước intake bắt buộc.

## 9. Không nhận được giờ sinh viết tự nhiên trong dữ liệu Bát tự

- Câu gửi ở lượt intake: `Mình sinh 12/03/1999, nữ, lúc 8 giờ sáng, ngân sách tối đa 80 triệu.`
- Kết quả thực tế: agent phân tích Kỷ Mão nhưng lại ghi `Giờ sinh: Chưa có giờ sinh` và `Không có giờ sinh`, dù người dùng đã nêu rõ 8 giờ sáng.
- Kỳ vọng: chuẩn hóa các cách nói phổ biến như `8 giờ sáng`, `8h`, `08:00`, `buổi sáng` thành dữ liệu giờ sinh hoặc hỏi xác nhận khi chưa đủ chính xác.
- Ảnh hưởng: Bát tự/Bát trạch được tính thiếu dữ liệu mà khách không biết dữ liệu mình vừa nhập đã bị bỏ qua.
