# Báo cáo nghiệm thu AI Agent và quy trình kiểm duyệt tri thức

Ngày kiểm thử: 09/08/2026  
Phạm vi: AI Agent khách hàng, tự học ở tầng ứng dụng, Knowledge Base/RAG, kiểm duyệt quản trị, lịch sử hội thoại, phân phối model và cơ chế dự phòng.

## Kết luận

Hệ thống đạt các tiêu chí an toàn nghiệp vụ chính. Nội dung do khách hàng cung cấp không được dùng làm tri thức chung trước khi quản trị viên duyệt. Khi dịch vụ model ngoài lỗi hoặc quá thời gian, lượt chat vẫn trả câu trả lời dự phòng và phần gợi ý câu hỏi không làm gián đoạn lượt chat chính.

## Quy trình đã xác minh

| Tình huống | Kết quả mong đợi | Kết quả |
| --- | --- | --- |
| Khách gửi FAQ/quy định dùng chung | Lưu `quarantined`, `is_active=false` | Đạt |
| Người dùng chưa đăng nhập yêu cầu lưu sở thích | Không tạo memory lâu dài | Đạt |
| Hai người dùng có cùng loại sở thích | Dữ liệu được cô lập theo tài khoản | Đạt |
| Nội dung nhạy cảm về y tế, tôn giáo hoặc tâm lý | Không lưu thành hồ sơ cá nhân | Đạt |
| Quản trị viên duyệt tri thức hợp lệ | Chuyển `active`, tạo version và audit | Đạt |
| Quản trị viên từ chối | Chuyển `rejected`, không tham gia RAG | Đạt |
| Duyệt lại bản đã xử lý | API từ chối `400` | Đạt |
| Thiếu căn cứ kiểm duyệt | API từ chối `400` | Đạt |
| Tri thức chat cố sửa giá, giảm giá, quyền hoặc điều kiện thanh toán | Chặn kích hoạt, giữ `quarantined` | Đạt |
| Embedding lỗi hoặc provider bận | Duyệt không bị mất; truy xuất SQL dự phòng còn hoạt động | Đạt |
| Chỉ lấy tri thức cho RAG | Chỉ `active`, đúng phạm vi và thời gian hiệu lực | Đạt |
| Lưu và mở lại lịch sử hội thoại | Khôi phục metadata và `suggestedFollowUps` | Đạt |
| Model gợi ý lỗi hoặc quá 1,8 giây | Backend trả mảng rỗng, frontend dùng rule dự phòng | Đạt |
| Model gợi ý chỉ trả 1–2 câu hoặc bị trùng | Giữ câu AI hợp lệ và bù đủ 3 câu không trùng | Đạt |
| 120B lỗi | Chat thử 20B, sau đó Mistral; cuối cùng trả local fallback | Đạt |
| Job gợi ý câu hỏi | Chỉ dùng pool 20B, không mượn 120B/Mistral | Đạt |
| Job embedding RAG | Chỉ dùng pool Llama embedding riêng/legacy embedding | Đạt |
| Customer gọi API quản trị | `403` | Đạt |
| Không đăng nhập gọi API quản trị | `401` | Đạt |
| ID hoặc trạng thái truy vấn sai | `400`, không âm thầm đổi bộ lọc | Đạt |
| Chào hỏi, cảm ơn, tạm biệt, hỏi tên, phản ứng ngắn | Trả tự nhiên, không gọi LLM | Đạt |
| Câu ngoài phạm vi rõ ràng | Chuyển hướng đúng phạm vi, không chờ failover | Đạt |
| Yêu cầu tiết lộ API key/prompt hệ thống | Từ chối tại backend, không gửi cho provider | Đạt |
| Tín hiệu tự gây hại | Trả hướng dẫn an toàn tức thời, không phụ thuộc model | Đạt |
| Hỏi giá/trạng thái bằng mã lô | Trả đúng lô từ dữ liệu hiện tại, không gợi ý lô khác | Đạt |
| Hỏi mức quan tâm bằng mã lô | Trả tín hiệu cạnh tranh nội bộ, không đổi thành tìm lô | Đạt |
| “Gợi ý 3 lô” | Hiểu là 3 phương án một-lô; không hiểu nhầm là mua nhóm 3 lô | Đạt |
| Từ chối lô nhiều lượt | Loại tích lũy, không lặp lô cũ, báo đúng số còn lại | Đạt |
| Giữ chỗ bằng mã lô | Đi đúng workflow đặt lô; chưa đăng nhập thì yêu cầu đăng nhập | Đạt |
| “OK” khi có yêu cầu chờ xác nhận | Xác nhận workflow; không bị nhánh xã giao nuốt mất | Đạt |
| Danh sách dịch vụ | Nội dung, card và action cùng đúng 5 dịch vụ | Đạt |
| Bát Tự có sẵn ngày sinh/giới tính | Không hỏi lại; chạy rule từ dữ liệu đã nhập | Đạt |
| Tin nhắn chỉ có khoảng trắng, quá dài hoặc sai kiểu | API từ chối `400` | Đạt |

## Kiểm thử tự động

- Backend unit: 60 test suite, 404 test, tất cả đạt.
- Backend end-to-end: 9 test suite, 156 test, tất cả đạt.
- Frontend: 21 test file, 76 test, tất cả đạt.
- Backend build: đạt.
- Frontend TypeScript và production build: đạt.
- `git diff --check`: đạt.

## Nghiệm thu trên API và cơ sở dữ liệu thật

- Phân quyền admin: không đăng nhập `401`, customer `403`, admin `200`.
- Duyệt, từ chối, chặn duyệt lại và chặn nội dung thay đổi quy tắc vận hành đều đúng trạng thái HTTP.
- Bản được duyệt là bản duy nhất trong dữ liệu test thỏa điều kiện truy xuất RAG.
- Mỗi quyết định duyệt/từ chối tạo một version và một audit log.
- Dữ liệu kiểm thử đã được xóa chính xác; không còn knowledge hoặc conversation mang mã kiểm thử.
- PostgreSQL `vector` đã cài. Tại thời điểm nghiệm thu có 7 knowledge embedding và 6 tri thức active có thể truy xuất.
- Đã chạy 39 hội thoại smoke riêng cho trải nghiệm khách hàng và xóa chính xác toàn bộ conversation có prefix kiểm thử; số còn lại sau dọn là 0.

## Nghiệm thu trải nghiệm khách hàng

- Thời gian phản hồi live sau sửa: chào hỏi khoảng 0,01–0,52 giây; câu ngoài phạm vi phổ biến khoảng 0,01–0,31 giây; từ chối thay đổi hệ thống khoảng 0,56 giây; giữ chỗ theo mã lô khi chưa đăng nhập khoảng 0,88 giây.
- Các tác vụ đọc dữ liệu như chi tiết lô, danh sách dịch vụ, quy trình giữ chỗ, Bát Tự và mức quan tâm lô hoàn tất khoảng 2–3,5 giây trong smoke test, gồm cả ngân sách tối đa 1,8 giây dành riêng cho follow-up tùy chọn.
- Ba lượt “không thích, đổi lô khác” liên tiếp trả 9 mã khác nhau; danh sách loại trừ được tích lũy qua lịch sử và không lặp lại lô cũ.
- Nhận xét so sánh được hiển thị thành một tin nhắn trợ lý riêng bên dưới bảng. Tác vụ Nemotron đã tắt thinking; backend và frontend cùng chặn nội dung suy luận nội bộ hoặc phản hồi không phải tiếng Việt.
- Khi model chính lỗi, câu nghiệp vụ có đường dữ liệu xác định vẫn chạy local. Những câu xã giao, ngoài phạm vi, bảo mật và an toàn không dùng key chat chính.
- Không hiển thị lỗi provider, API key, timeout hoặc thuật ngữ nội bộ cho khách hàng.

## Thay đổi giao diện quản trị

- Hàng chờ kiểm duyệt chỉ tải tri thức và phản hồi đang chờ.
- Quản trị viên phải nhập căn cứ trước khi duyệt hoặc từ chối.
- Thêm bảng “Kho tri thức” có tìm kiếm và lọc theo trạng thái: đang dùng, chờ xác minh, đã từ chối, đã thay thế.
- Giải thích rõ chỉ tri thức “Đang được Agent sử dụng” mới tham gia KB/RAG.
- Đổi các thuật ngữ kỹ thuật khó hiểu sang nhãn nghiệp vụ tiếng Việt.
- Bổ sung thông báo lỗi cho thao tác tạo, triển khai và khôi phục bộ xếp hạng.
- Giữ thiết kế hiện tại của trang admin và không dùng emoji.

## Ghi nhận vận hành

Trong smoke test trực tiếp, NVIDIA NIM có lúc trả HTTP 500 hoặc quá thời gian. GPT-OSS cũng có lượt vượt timeout. Đây là trạng thái provider tại thời điểm kiểm thử, không phải lỗi dữ liệu nội bộ. Hệ thống đã trả câu trả lời local thay vì trả lỗi cho khách hàng. Planner hiện dành tối đa 5 giây cho mỗi provider trong ngân sách 12 giây; job gợi ý câu hỏi vẫn bị giới hạn tuyệt đối 1,8 giây.

Frontend production build còn cảnh báo kích thước bundle lớn hơn 500 kB. Cảnh báo này không ảnh hưởng chức năng AI/KB nhưng nên được xử lý bằng code splitting trong đợt tối ưu hiệu năng riêng.
