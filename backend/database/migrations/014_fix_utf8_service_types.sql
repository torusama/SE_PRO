-- Repair service catalogue text that was imported as UTF-8 bytes interpreted
-- through a Windows code page. Exact damaged values are checked so rerunning
-- this migration cannot overwrite later catalogue edits.

BEGIN;

ALTER TABLE service_types
  ALTER COLUMN unit SET DEFAULT 'lần';

WITH fixes (
  sort_order,
  damaged_name,
  corrected_name,
  damaged_description,
  corrected_description,
  damaged_unit,
  corrected_unit
) AS (
  VALUES
    (
      1,
      'Dá»‹ch vá»¥ mai tÃ¡ng',
      'Dịch vụ mai táng',
      'Há»— trá»£ toÃ n bá»™ quy trÃ¬nh mai tÃ¡ng táº¡i nghÄ©a trang',
      'Hỗ trợ toàn bộ quy trình mai táng tại nghĩa trang',
      'láº§n',
      'lần'
    ),
    (
      2,
      'ChÄƒm sÃ³c má»™ Ä‘á»‹nh ká»³',
      'Chăm sóc mộ định kỳ',
      'Vá»‡ sinh, chÄƒm sÃ³c má»™ pháº§n hÃ ng thÃ¡ng',
      'Vệ sinh, chăm sóc mộ phần hàng tháng',
      'thÃ¡ng',
      'tháng'
    ),
    (
      3,
      'Dá»n dáº¹p má»™',
      'Dọn dẹp mộ',
      'LÃ m cá», vá»‡ sinh khu vá»±c xung quanh má»™',
      'Làm cỏ, vệ sinh khu vực xung quanh mộ',
      'láº§n',
      'lần'
    ),
    (
      4,
      'Thay hoa tÆ°Æ¡i',
      'Thay hoa tươi',
      'Thay hoa tÆ°Æ¡i theo yÃªu cáº§u',
      'Thay hoa tươi theo yêu cầu',
      'láº§n',
      'lần'
    ),
    (
      5,
      'Tháº¯p hÆ°Æ¡ng',
      'Thắp hương',
      'Tháº¯p hÆ°Æ¡ng táº¡i má»™ vÃ o cÃ¡c ngÃ y Ä‘áº·c biá»‡t',
      'Thắp hương tại mộ vào các ngày đặc biệt',
      'láº§n',
      'lần'
    ),
    (
      6,
      'Dá»‹ch vá»¥ tÆ°á»Ÿng niá»‡m',
      'Dịch vụ tưởng niệm',
      'Tá»• chá»©c buá»•i lá»… tÆ°á»Ÿng niá»‡m táº¡i má»™ pháº§n',
      'Tổ chức buổi lễ tưởng niệm tại mộ phần',
      'buá»•i',
      'buổi'
    ),
    (
      7,
      'SÆ¡n sá»­a bia má»™',
      'Sơn sửa bia mộ',
      'SÆ¡n láº¡i bia má»™ vÃ  khu vá»±c xung quanh',
      'Sơn lại bia mộ và khu vực xung quanh',
      'láº§n',
      'lần'
    ),
    (
      8,
      'Chá»¥p áº£nh má»™ pháº§n',
      'Chụp ảnh mộ phần',
      'Ghi láº¡i hÃ¬nh áº£nh má»™ pháº§n vÃ  gá»­i vá» cho gia Ä‘Ã¬nh',
      'Ghi lại hình ảnh mộ phần và gửi về cho gia đình',
      'láº§n',
      'lần'
    )
)
UPDATE service_types AS service
SET
  name = CASE
    WHEN service.name = fixes.damaged_name THEN fixes.corrected_name
    ELSE service.name
  END,
  description = CASE
    WHEN service.description = fixes.damaged_description
      THEN fixes.corrected_description
    ELSE service.description
  END,
  unit = CASE
    WHEN service.unit = fixes.damaged_unit THEN fixes.corrected_unit
    ELSE service.unit
  END
FROM fixes
WHERE service.sort_order = fixes.sort_order
  AND (
    service.name = fixes.damaged_name
    OR service.description = fixes.damaged_description
    OR service.unit = fixes.damaged_unit
  );

COMMIT;
