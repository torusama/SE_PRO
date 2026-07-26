-- Repair seed user names that were previously imported as UTF-8 bytes
-- interpreted through a Windows code page.
--
-- Each update checks the exact damaged value so this migration is idempotent
-- and cannot overwrite a name that the user has changed later.

BEGIN;

UPDATE users
SET full_name = 'Quản trị viên Hệ thống'
WHERE email = 'admin@cemetery.vn'
  AND full_name = 'Quáº£n trá»‹ viÃªn Há»‡ thá»‘ng';

UPDATE users
SET full_name = 'Phó Quản trị viên'
WHERE email = 'admin2@cemetery.vn'
  AND full_name = 'PhÃ³ Quáº£n trá»‹ viÃªn';

UPDATE users
SET full_name = 'Nguyễn Văn An'
WHERE email = 'khachhang1@gmail.com'
  AND full_name = 'Nguyá»…n VÄƒn An';

UPDATE users
SET full_name = 'Trần Thị Bình'
WHERE email = 'khachhang2@gmail.com'
  AND full_name = 'Tráº§n Thá»‹ BÃ¬nh';

UPDATE users
SET full_name = 'Lê Văn Cường'
WHERE email = 'khachhang3@gmail.com'
  AND full_name = 'LÃª VÄƒn CÆ°á»ng';

UPDATE users
SET full_name = 'Phạm Thị Dung'
WHERE email = 'khachhang4@gmail.com'
  AND full_name IN ('Pháº¡m Thá»‹ Dung', 'PPhạm Thị Dung');

COMMIT;
