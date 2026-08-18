


-- Seed data is currently included at the bottom of DBase.sql.
-- Keep this file for future data-only seed scripts.
UPDATE users
SET full_name = 'Quản trị viên Hệ thống'
WHERE email = 'admin@cemetery.vn';
SELECT full_name
FROM users
WHERE email = 'admin@cemetery.vn';