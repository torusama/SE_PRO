-- Cho phép nhập "Ngày sinh" và "Ngày giỗ" theo MỘT chế độ lịch chung cho cả
-- hồ sơ (Dương lịch hoặc Âm lịch) do người dùng chọn. Giá trị luôn được lưu
-- NGUYÊN VẸN theo đúng số ngày/tháng/năm đã nhập — không quy đổi lúc lưu.
-- Việc quy đổi Âm -> Dương chỉ diễn ra khi tạo/khớp nhắc lịch (xem
-- deceased.service.ts / reminders), lúc đó mới cần biết ngày Dương tương
-- ứng của năm cần nhắc.
--
-- "Ngày mất" (date_of_death) và "Ngày an táng" (burial_date) trước đây bị
-- gộp lại thành một khái niệm duy nhất "Ngày giỗ" (anniversary), dùng
-- anniversary_day/anniversary_month đã có sẵn (luôn ý nghĩa Dương HOẶC Âm
-- tuỳ date_calendar_type), bổ sung thêm anniversary_year để lưu năm mất.
-- Cột date_of_death/burial_date cũ vẫn giữ lại (không xoá) để không phá vỡ
-- dữ liệu hồ sơ đã tạo trước đây.

ALTER TABLE deceased_profiles
  ADD COLUMN IF NOT EXISTS date_calendar_type VARCHAR(10) NOT NULL DEFAULT 'solar'
    CHECK (date_calendar_type IN ('solar', 'lunar')),
  ADD COLUMN IF NOT EXISTS birth_day SMALLINT CHECK (birth_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS birth_month SMALLINT CHECK (birth_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS birth_year SMALLINT CHECK (birth_year BETWEEN 1 AND 9999),
  ADD COLUMN IF NOT EXISTS anniversary_year SMALLINT CHECK (anniversary_year BETWEEN 1 AND 9999);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_birth_day_month_pair'
  ) THEN
    ALTER TABLE deceased_profiles
      ADD CONSTRAINT chk_birth_day_month_pair CHECK (
        (birth_day IS NULL) = (birth_month IS NULL)
      );
  END IF;
END $$;
