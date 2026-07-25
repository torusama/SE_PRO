-- Migration 011: Thêm 4 khu bán thật mới — Khu E (Cải táng), Khu F (Mật độ
-- cao), Khu G (Mở rộng), Khu H (Mộ đơn) — theo bố cục "tổng mặt bằng" mới
-- của bản đồ 2D (đường chính bên phải, đường bao chéo bên trái, Khu Tâm
-- Linh ở giữa). Idempotent: chạy lại nhiều lần không tạo trùng dữ liệu.
--
-- Lưu ý: cột map_x/map_y/map_width/map_height chỉ mang tính tham khảo/lưu
-- trữ — vị trí hiển thị thật trên bản đồ 2D do frontend
-- (frontend/src/lib/cemeteryMapLayout.ts) tự tính theo zone_code + row/col,
-- không đọc trực tiếp các cột này.

BEGIN;

INSERT INTO cemetery_zones (zone_code, zone_name, description, map_x, map_y, map_width, map_height, color_hex, sort_order)
VALUES
  ('E', 'Khu E - Cải táng',   'Khu vực dành cho mộ cải táng, quy trình di dời/an táng lại theo đúng nghi thức truyền thống.', 0,   0, 300, 250, '#CDEFF6', 5),
  ('F', 'Khu F - Mật độ cao', 'Khu vực mật độ cao, diện tích mỗi lô nhỏ gọn, mức giá tối ưu cho ngân sách vừa phải.',        310, 0, 300, 250, '#DCF3E4', 6),
  ('G', 'Khu G - Mở rộng',    'Khu mở rộng mới, không gian rộng rãi, còn nhiều lô đẹp để lựa chọn vị trí.',                    0, 260, 300, 300, '#CDEFDD', 7),
  ('H', 'Khu H - Mộ đơn',     'Khu bố trí các mộ đơn lẻ, phù hợp nhu cầu an táng cá nhân với chi phí hợp lý.',                310, 260, 300, 300, '#FBE6C8', 8)
ON CONFLICT (zone_code) DO NOTHING;

-- Plots — Khu E (10 lô đơn, mộ cải táng)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
SELECT * FROM (VALUES
  ('E-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '001',  10::float,  10::float, 40::float, 40::float, 3.0, 28000000::numeric, 'Nam',   'single', 'available'),
  ('E-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '002',  55,  10, 40, 40, 3.0, 28000000, 'Nam',   'single', 'available'),
  ('E-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '003', 100,  10, 40, 40, 3.0, 29000000, 'Đông',  'single', 'available'),
  ('E-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '004', 145,  10, 40, 40, 3.0, 29000000, 'Đông',  'single', 'available'),
  ('E-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '005', 190,  10, 40, 40, 3.0, 28000000, 'Nam',   'single', 'available'),
  ('E-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '001',  10,  60, 40, 40, 3.0, 27000000, 'Tây',   'single', 'available'),
  ('E-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '002',  55,  60, 40, 40, 3.0, 27000000, 'Tây',   'single', 'available'),
  ('E-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '003', 100,  60, 40, 40, 3.0, 28000000, 'Bắc',   'single', 'available'),
  ('E-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '004', 145,  60, 40, 40, 3.0, 28000000, 'Bắc',   'single', 'available'),
  ('E-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '005', 190,  60, 40, 40, 3.0, 27000000, 'Nam',   'single', 'available')
) AS v(plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
ON CONFLICT (plot_code) DO NOTHING;

-- Plots — Khu F (12 lô đơn, mật độ cao)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
SELECT * FROM (VALUES
  ('F-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '001',  10::float,  10::float, 35::float, 35::float, 2.4, 24000000::numeric, 'Nam',   'single', 'available'),
  ('F-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '002',  50,  10, 35, 35, 2.4, 24000000, 'Nam',   'single', 'available'),
  ('F-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '003',  90,  10, 35, 35, 2.4, 25000000, 'Đông',  'single', 'available'),
  ('F-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '004', 130,  10, 35, 35, 2.4, 25000000, 'Đông',  'single', 'available'),
  ('F-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '005', 170,  10, 35, 35, 2.4, 24000000, 'Nam',   'single', 'available'),
  ('F-01-006', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '006', 210,  10, 35, 35, 2.4, 23000000, 'Tây',   'single', 'available'),
  ('F-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '001',  10,  55, 35, 35, 2.4, 23000000, 'Tây',   'single', 'available'),
  ('F-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '002',  50,  55, 35, 35, 2.4, 23000000, 'Bắc',   'single', 'available'),
  ('F-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '003',  90,  55, 35, 35, 2.4, 24000000, 'Bắc',   'single', 'available'),
  ('F-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '004', 130,  55, 35, 35, 2.4, 24000000, 'Nam',   'single', 'available'),
  ('F-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '005', 170,  55, 35, 35, 2.4, 23000000, 'Nam',   'single', 'available'),
  ('F-02-006', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '006', 210,  55, 35, 35, 2.4, 22000000, 'Đông',  'single', 'available')
) AS v(plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
ON CONFLICT (plot_code) DO NOTHING;

-- Plots — Khu G (10 lô đơn, khu mở rộng)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
SELECT * FROM (VALUES
  ('G-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '001',  10::float,  10::float, 40::float, 40::float, 3.2, 36000000::numeric, 'Nam',   'single', 'available'),
  ('G-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '002',  55,  10, 40, 40, 3.2, 36000000, 'Nam',   'single', 'available'),
  ('G-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '003', 100,  10, 40, 40, 3.2, 37000000, 'Đông',  'single', 'available'),
  ('G-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '004', 145,  10, 40, 40, 3.2, 37000000, 'Đông',  'single', 'available'),
  ('G-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '005', 190,  10, 40, 40, 3.2, 36000000, 'Nam',   'single', 'available'),
  ('G-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '001',  10,  60, 40, 40, 3.2, 35000000, 'Tây',   'single', 'available'),
  ('G-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '002',  55,  60, 40, 40, 3.2, 35000000, 'Tây',   'single', 'available'),
  ('G-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '003', 100,  60, 40, 40, 3.2, 36000000, 'Bắc',   'single', 'available'),
  ('G-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '004', 145,  60, 40, 40, 3.2, 36000000, 'Bắc',   'single', 'available'),
  ('G-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '005', 190,  60, 40, 40, 3.2, 35000000, 'Nam',   'single', 'available')
) AS v(plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
ON CONFLICT (plot_code) DO NOTHING;

-- Plots — Khu H (10 lô đơn)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
SELECT * FROM (VALUES
  ('H-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '001',  10::float,  10::float, 40::float, 40::float, 3.0, 30000000::numeric, 'Nam',   'single', 'available'),
  ('H-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '002',  55,  10, 40, 40, 3.0, 30000000, 'Nam',   'single', 'available'),
  ('H-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '003', 100,  10, 40, 40, 3.0, 31000000, 'Đông',  'single', 'available'),
  ('H-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '004', 145,  10, 40, 40, 3.0, 31000000, 'Đông',  'single', 'available'),
  ('H-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '005', 190,  10, 40, 40, 3.0, 30000000, 'Nam',   'single', 'available'),
  ('H-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '001',  10,  60, 40, 40, 3.0, 29000000, 'Tây',   'single', 'available'),
  ('H-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '002',  55,  60, 40, 40, 3.0, 29000000, 'Tây',   'single', 'available'),
  ('H-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '003', 100,  60, 40, 40, 3.0, 30000000, 'Bắc',   'single', 'available'),
  ('H-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '004', 145,  60, 40, 40, 3.0, 30000000, 'Bắc',   'single', 'available'),
  ('H-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '005', 190,  60, 40, 40, 3.0, 29000000, 'Nam',   'single', 'available')
) AS v(plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status)
ON CONFLICT (plot_code) DO NOTHING;

COMMIT;

-- Các ô còn lại trong lưới của mỗi khu (đến hết số hàng/cột khai báo trong
-- frontend/src/lib/cemeteryMapLayout.ts) sẽ tự hiển thị dạng "Chưa có dữ
-- liệu" (placeholder có thể xem, không thể chọn) — đúng hành vi hiện có
-- của Khu A/B/D, không cần seed đủ 100% để bản đồ hiển thị đẹp.
