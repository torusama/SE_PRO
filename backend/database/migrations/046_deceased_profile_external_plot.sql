-- Cho phép tạo hồ sơ tưởng niệm cho người thân được an táng ở "Lô đất ngoài
-- nghĩa trang" (không thuộc lô nào đang được quản lý/bán bởi hệ thống).
--
-- Khác với hồ sơ gắn với lô trong nghĩa trang (phải chờ admin xác minh, và
-- khi xoá phải gửi yêu cầu chờ admin duyệt), hồ sơ "ngoài nghĩa trang":
--   - Được lưu và xác nhận NGAY (verification_status='verified'), không cần
--     admin duyệt vì không liên quan tới lô đất hệ thống đang quản lý.
--   - Khi xoá, gia đình tự xoá thẳng (sau khi xác nhận trong popup cảnh báo
--     không thể hoàn tác), không cần gửi yêu cầu tới admin.
--
-- plot_id vì vậy phải cho phép NULL cho loại hồ sơ này.

ALTER TABLE deceased_profiles
  ALTER COLUMN plot_id DROP NOT NULL;

ALTER TABLE deceased_profiles
  ADD COLUMN IF NOT EXISTS is_external_plot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS external_plot_note VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_deceased_plot_or_external'
  ) THEN
    ALTER TABLE deceased_profiles
      ADD CONSTRAINT chk_deceased_plot_or_external CHECK (
        (is_external_plot = TRUE AND plot_id IS NULL)
        OR (is_external_plot = FALSE AND plot_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deceased_external_active
  ON deceased_profiles(created_by)
  WHERE is_external_plot = TRUE AND is_deleted = FALSE;
