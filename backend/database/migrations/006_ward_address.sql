-- Từ 1/7/2025 Việt Nam bỏ cấp huyện, chỉ còn 2 cấp: Tỉnh/Thành phố và Xã/Phường
-- (Nghị quyết 202/2025/QH15). Cột `city` đã có sẵn dùng cho Tỉnh/Thành phố; thêm
-- cột `ward` cho Xã/Phường. Trường `address` giờ chỉ còn chứa "số nhà, tên đường".

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ward VARCHAR(150);
