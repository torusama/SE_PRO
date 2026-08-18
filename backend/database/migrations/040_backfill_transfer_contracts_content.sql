-- Migration 040: Backfill contract_base_content and contract_content for transfer contracts
DO $$
DECLARE
    rec RECORD;
    seller_full_name TEXT;
    seller_id_card TEXT;
    seller_phone TEXT;
    seller_address TEXT;
    buyer_full_name TEXT;
    buyer_id_card TEXT;
    buyer_phone TEXT;
    buyer_address TEXT;
    plots_text TEXT;
    prices_text TEXT;
    total_str TEXT;
    base_content TEXT;
    full_content TEXT;
    total_num NUMERIC;
BEGIN
    FOR rec IN
        SELECT c.contract_id, c.contract_code, c.request_id, c.user_id, c.total_amount,
               rr.user_id AS seller_user_id,
               trd.recipient_full_name, trd.recipient_id_card, trd.recipient_phone,
               trd.recipient_address
        FROM contracts c
        LEFT JOIN reservation_requests rr ON rr.request_id = c.request_id
        LEFT JOIN transfer_request_details trd ON trd.request_id = c.request_id
        WHERE c.ownership_source IN ('transfer', 'inheritance')
          AND (c.contract_base_content IS NULL OR BTRIM(c.contract_base_content) = '')
    LOOP
        -- Get seller info
        SELECT COALESCE(full_name, 'Chủ sở hữu cũ'),
               COALESCE(id_card_number, '................................'),
               COALESCE(phone_number, '................................'),
               COALESCE(address, '................................')
        INTO seller_full_name, seller_id_card, seller_phone, seller_address
        FROM users WHERE user_id = rec.seller_user_id;

        IF seller_full_name IS NULL THEN
            seller_full_name := 'Chủ sở hữu cũ';
            seller_id_card := '................................';
            seller_phone := '................................';
            seller_address := '................................';
        END IF;

        -- Get buyer info
        buyer_full_name := COALESCE(NULLIF(rec.recipient_full_name, ''), (SELECT full_name FROM users WHERE user_id = rec.user_id), 'Người nhận');
        buyer_id_card := COALESCE(NULLIF(rec.recipient_id_card, ''), (SELECT id_card_number FROM users WHERE user_id = rec.user_id), '................................');
        buyer_phone := COALESCE(NULLIF(rec.recipient_phone, ''), (SELECT phone_number FROM users WHERE user_id = rec.user_id), '................................');
        buyer_address := COALESCE(NULLIF(rec.recipient_address, ''), (SELECT address FROM users WHERE user_id = rec.user_id), '................................');

        -- Get plot details
        SELECT string_agg(row_num || '. Lô ' || plot_code || COALESCE(', ' || zone_name, '') || ', diện tích ' || COALESCE(area_sqm::text, '...') || ' m².', E'\n')
        INTO plots_text
        FROM (
            SELECT ROW_NUMBER() OVER (ORDER BY p.plot_code) AS row_num,
                   p.plot_code, z.zone_name, p.area_sqm
            FROM contract_plots cp
            JOIN plots p ON p.plot_id = cp.plot_id
            LEFT JOIN cemetery_zones z ON z.zone_id = p.zone_id
            WHERE cp.contract_id = rec.contract_id
        ) sub;

        IF plots_text IS NULL THEN
            SELECT '1. Lô ' || p.plot_code || COALESCE(', ' || z.zone_name, '') || ', diện tích ' || COALESCE(p.area_sqm::text, '...') || ' m².'
            INTO plots_text
            FROM contracts c
            JOIN plots p ON p.plot_id = c.plot_id
            LEFT JOIN cemetery_zones z ON z.zone_id = p.zone_id
            WHERE c.contract_id = rec.contract_id;
        END IF;

        total_num := COALESCE(rec.total_amount, 0);
        total_str := to_char(total_num, 'FM999,999,999,999');
        IF total_str IS NULL OR total_str = '' THEN
            total_str := '0';
        END IF;

        SELECT string_agg(row_num || '. Lô ' || plot_code || ': ' || to_char(COALESCE(agreed_price, 0), 'FM999,999,999,999') || ' đồng.', E'\n')
        INTO prices_text
        FROM (
            SELECT ROW_NUMBER() OVER (ORDER BY p.plot_code) AS row_num,
                   p.plot_code, cp.agreed_price
            FROM contract_plots cp
            JOIN plots p ON p.plot_id = cp.plot_id
            WHERE cp.contract_id = rec.contract_id
        ) sub;

        IF prices_text IS NULL THEN
            prices_text := '1. Lô đất: ' || total_str || ' đồng.';
        END IF;

        base_content := 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

HỢP ĐỒNG CUNG CẤP QUYỀN SỬ DỤNG VỊ TRÍ PHẦN MỘ VÀ DỊCH VỤ NGHĨA TRANG
Số: ' || rec.contract_code || '

Căn cứ Bộ luật Dân sự số 91/2015/QH13 và pháp luật Việt Nam có liên quan;
Căn cứ nhu cầu của Bên B và khả năng cung cấp dịch vụ của Bên A;

BÊN A - BÊN CHUYỂN NHƯỢNG
Họ tên: ' || seller_full_name || '
CCCD/CMND: ' || seller_id_card || '
Địa chỉ: ' || seller_address || '
Điện thoại: ' || seller_phone || '

BÊN B - BÊN NHẬN
Họ tên: ' || buyer_full_name || '
CCCD/CMND: ' || buyer_id_card || '
Địa chỉ: ' || buyer_address || '
Điện thoại: ' || buyer_phone || '

ĐIỀU 1. ĐỐI TƯỢNG HỢP ĐỒNG
Bên A cung cấp cho Bên B quyền sử dụng các vị trí phần mộ sau:
' || COALESCE(plots_text, '') || '
Các vị trí trên được sử dụng theo quy hoạch và quy chế quản lý nghĩa trang. Hợp đồng này không mặc nhiên là hợp đồng chuyển nhượng quyền sử dụng đất.

ĐIỀU 2. GIÁ TRỊ VÀ THANH TOÁN
' || COALESCE(prices_text, '') || '
Tổng giá trị hợp đồng: ' || total_str || ' đồng. Thời hạn, phương thức và chứng từ thanh toán thực hiện theo thỏa thuận/phiếu thu hợp lệ của hai bên.

ĐIỀU 3. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A
Bàn giao đúng vị trí, cung cấp thông tin quy chế; quản lý, bảo vệ hạ tầng chung; tôn trọng quyền hợp pháp của Bên B; thông báo các khoản phí và thay đổi có liên quan theo hợp đồng và pháp luật.

ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B
Thanh toán đầy đủ; sử dụng đúng mục đích mai táng, đúng quy hoạch, nội quy, vệ sinh và môi trường; không tự ý chuyển giao, thay đổi hiện trạng hoặc sử dụng vị trí vào mục đích khác khi chưa được chấp thuận hợp lệ.

ĐIỀU 5. THỜI HẠN, CHẤM DỨT VÀ GIẢI QUYẾT TRANH CHẤP
Thời hạn và thời điểm có hiệu lực được ghi tại phần ký kết. Hai bên ưu tiên thương lượng; nếu không thành, tranh chấp được giải quyết tại cơ quan có thẩm quyền theo pháp luật Việt Nam.';

        full_content := base_content || E'\n\nĐIỀU 6. ĐIỀU KHOẢN CHUNG\nHai bên đã đọc, hiểu, tự nguyện ký và chịu trách nhiệm về thông tin cung cấp. Hợp đồng được lập thành các bản có giá trị như nhau.\n\nĐẠI DIỆN BÊN A                              BÊN B\n(Ký, ghi rõ họ tên, chức vụ, đóng dấu)       (Ký, ghi rõ họ tên)';

        UPDATE contracts
        SET contract_base_content = base_content,
            contract_content = full_content
        WHERE contract_id = rec.contract_id;
    END LOOP;
END $$;
