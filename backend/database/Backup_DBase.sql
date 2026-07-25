-- ================================================================
-- SCRIPT SỬA LỖI ENCODING DỮ LIỆU ĐÃ CÓ TRONG DATABASE
-- ================================================================

UPDATE users SET full_name = 'Quản trị viên Hệ thống', address = 'TP Hồ Chí Minh'
WHERE email = 'admin@cemetery.vn';

UPDATE users SET full_name = 'Quản trị viên Hệ thống', address = 'TP Hồ Chí Minh'
WHERE email = 'admin2@cemetery.vn';

UPDATE users SET full_name = 'Nguyễn Văn A', address = 'Quận 1, TP.HCM'
WHERE email = 'khachhang1@gmail.com';

UPDATE users SET full_name = 'Trần Thị Bình', address = 'Quận 3, TP.HCM'
WHERE email = 'khachhang2@gmail.com';

UPDATE users SET full_name = 'Lê Văn Cường', address = 'Quận 7, TP.HCM'
WHERE email = 'khachhang3@gmail.com';

UPDATE users SET full_name = 'Phạm Thị Dung', address = 'Bình Dương'
WHERE email = 'khachhang4@gmail.com';

UPDATE cemetery_zones SET zone_name = 'Khu A - Cao Cấp',
    description = 'Khu vực cao cấp, phong thủy tốt, gần cổng chính'
WHERE zone_code = 'A';

UPDATE cemetery_zones SET zone_name = 'Khu B - Tiêu Chuẩn',
    description = 'Khu vực tiêu chuẩn, diện tích vừa phải'
WHERE zone_code = 'B';

UPDATE cemetery_zones SET zone_name = 'Khu C - Gia Đình',
    description = 'Khu vực dành cho nhóm lô gia đình hoặc dòng họ'
WHERE zone_code = 'C';

UPDATE cemetery_zones SET zone_name = 'Khu D - Bình Dân',
    description = 'Khu vực giá phổ thông'
WHERE zone_code = 'D';

UPDATE plots SET direction = 'Đông' WHERE plot_code IN ('A-01-003','A-01-004','B-01-003','B-01-004','C-01-003','C-02-001','C-02-002','D-01-003','D-01-004');
UPDATE plots SET direction = 'Tây'  WHERE plot_code IN ('A-02-003','A-02-004');
UPDATE plots SET direction = 'Bắc'  WHERE plot_code IN ('B-02-003','B-02-004','D-02-003','D-02-004');

UPDATE service_types SET name = 'Dịch vụ mai táng',
    description = 'Hỗ trợ toàn bộ quy trình mai táng tại nghĩa trang', unit = 'lần'
WHERE name LIKE '%mai t%';

UPDATE service_types SET name = 'Chăm sóc mộ định kỳ',
    description = 'Vệ sinh, chăm sóc mộ phần hàng tháng', unit = 'tháng'
WHERE category = 'maintenance' AND sort_order = 2;

UPDATE service_types SET name = 'Dọn dẹp mộ',
    description = 'Làm cỏ, vệ sinh khu vực xung quanh mộ', unit = 'lần'
WHERE category = 'maintenance' AND sort_order = 3;

UPDATE service_types SET name = 'Thay hoa tươi',
    description = 'Thay hoa tươi theo yêu cầu', unit = 'lần'
WHERE category = 'maintenance' AND sort_order = 4;

UPDATE service_types SET name = 'Thắp hương',
    description = 'Thắp hương tại mộ vào các ngày đặc biệt', unit = 'lần'
WHERE category = 'memorial' AND sort_order = 5;

UPDATE service_types SET name = 'Dịch vụ tưởng niệm',
    description = 'Tổ chức buổi lễ tưởng niệm tại mộ phần', unit = 'buổi'
WHERE category = 'memorial' AND sort_order = 6;

UPDATE service_types SET name = 'Sơn sửa bia mộ',
    description = 'Sơn lại bia mộ và khu vực xung quanh', unit = 'lần'
WHERE category = 'maintenance' AND sort_order = 7;

UPDATE service_types SET name = 'Chụp ảnh mộ phần',
    description = 'Ghi lại hình ảnh mộ phần và gửi về cho gia đình', unit = 'lần'
WHERE category = 'other' AND sort_order = 8;

UPDATE service_orders SET note = 'Chăm sóc mộ 3 tháng' WHERE service_type_id = 2 AND quantity = 3;
UPDATE service_orders SET note = 'Thắp hương ngày giỗ' WHERE service_type_id = 5 AND quantity = 2;
UPDATE service_orders SET note = 'Dọn dẹp mộ' WHERE service_type_id = 3 AND quantity = 1;

UPDATE notifications SET title = 'Yêu cầu đã được duyệt',
    message = 'Yêu cầu mua lô A-01-003 của bạn đã được phê duyệt. Hợp đồng HD-2026-0001 đã được tạo.'
WHERE type = 'request_approved' AND related_entity_id = 1;

UPDATE notifications SET title = 'Hợp đồng đã được tạo',
    message = 'Hợp đồng HD-2026-0001 đã được tạo thành công. Vui lòng kiểm tra thông tin hợp đồng.'
WHERE type = 'contract_created' AND related_entity_id = 1;

UPDATE notifications SET title = 'Yêu cầu đã được gửi',
    message = 'Yêu cầu mua lô của bạn đã được gửi thành công. Chúng tôi sẽ xử lý trong 1-3 ngày làm việc.'
WHERE type = 'request_submitted' AND user_id = 4;

UPDATE notifications SET title = 'Có yêu cầu mới cần xử lý',
    message = 'Khách hàng Trần Thị Bình vừa gửi yêu cầu mua lô. Vui lòng xem xét và phê duyệt.'
WHERE type = 'request_submitted' AND user_id = 1;

UPDATE notifications SET title = 'Dịch vụ đã hoàn thành',
    message = 'Dịch vụ thắp hương tại lô A-01-003 đã được thực hiện thành công.'
WHERE type = 'service_completed';

UPDATE reminders SET title = 'Ngày giỗ của Nguyễn Thị Mẹ',
    description = 'Ngày giỗ hàng năm của cụ Nguyễn Thị Mẹ'
WHERE reminder_type = 'death_anniversary';

UPDATE reminders SET title = 'Ngày tưởng niệm',
    description = 'Ngày ký hợp đồng 01/06 - nhắc thắp hương'
WHERE reminder_type = 'memorial';

-- Kiểm tra lại
SELECT user_id, email, full_name, address FROM users;
SELECT zone_code, zone_name FROM cemetery_zones;
SELECT plot_code, direction FROM plots WHERE direction IN ('Đông','Tây','Bắc');

UPDATE users SET full_name = 'Quản trị viên Hệ thống' WHERE email = 'admin2@cemetery.vn';

SELECT user_id, email, full_name FROM users WHERE role = 'Admin';