BEGIN;

UPDATE cemetery_zones
SET zone_name = 'Khu A - Cao cấp',
    description = 'Khu vực cao cấp, phong thủy tốt, gần cổng chính'
WHERE zone_code = 'A';

UPDATE cemetery_zones
SET zone_name = 'Khu B - Tiêu chuẩn',
    description = 'Khu vực tiêu chuẩn, diện tích vừa phải'
WHERE zone_code = 'B';

UPDATE cemetery_zones
SET zone_name = 'Khu C - Gia đình',
    description = 'Khu vực dành cho nhóm lô gia đình hoặc dòng họ'
WHERE zone_code = 'C';

UPDATE cemetery_zones
SET zone_name = 'Khu D - Bình dân',
    description = 'Khu vực giá phổ thông'
WHERE zone_code = 'D';

COMMIT;
