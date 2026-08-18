-- Curated cultural-reference knowledge for the AI Cemetery Concierge.
-- The records are deliberately framed as cultural/spiritual reference, not
-- scientific claims or guaranteed predictions. They are pinned for spiritual
-- consultation queries by KnowledgeService, so they remain available even
-- while semantic embeddings are unavailable or awaiting backfill.

INSERT INTO ai_knowledge_entries
  (knowledge_key, category, title, content, knowledge_type, source_type,
   source_reference, scope, owner_user_id, memory_key, validation_status,
   validation_reason, source_role, is_active, effective_from, updated_at)
VALUES
  (
    'spiritual-bazi-scope-v1',
    'spiritual_consultation',
    'Phân biệt Bát Tự/Tứ Trụ với Can Chi năm sinh và Bát Trạch',
    'Bát Tự (Four Pillars/Tứ Trụ) là hệ thống dùng bốn trụ năm, tháng, ngày và giờ; mỗi trụ gồm một Thiên Can và một Địa Chi. Nhật Can/Day Master của trụ ngày là điểm tham chiếu quan trọng trong phân tích Bát Tự. Vì vậy, chỉ có Can Chi năm sinh, Nạp Âm, chi giờ sinh và Cung Mệnh/Bát Trạch thì chưa phải lá số Bát Tự đầy đủ. Khi công cụ hiện tại trả kết quả, trợ lý phải gọi đúng phạm vi: Can Chi năm sinh + Nạp Âm + Bát Trạch/Mệnh Quái, có thể thêm chi giờ nếu biết. Nếu người dùng hỏi phân tích Bát Tự chuyên sâu, phải nói rõ rằng hệ thống chưa tính đủ trụ tháng, trụ ngày, Can của trụ giờ, Nhật Chủ, tàng can, thập thần hay đại vận; không được tự bịa các phần này.',
    'faq',
    'system_research',
    'Hong Kong Observatory, Heavenly Stems and Earthly Branches: https://www.hko.gov.hk/en/gts/time/stemsandbranches.htm ; Four Pillars overview and references: https://en.wikipedia.org/wiki/Four_Pillars_of_Destiny',
    'global',
    NULL,
    'spiritual:bazi_scope',
    'active',
    'Curated cultural-reference seed. Separates the currently implemented year-based/Bat-Trach tool from a full Four Pillars calculation.',
    'system',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'spiritual-bat-trach-method-v1',
    'spiritual_consultation',
    'Bát Trạch/Mệnh Quái: cách đọc bốn hướng cát và bốn hướng hung',
    'Bát Trạch (Eight Mansions/Ba Zhai) là một phương pháp phong thủy thuộc nhánh dùng phương hướng/la bàn. Mệnh Quái thường chia người thành Đông Tứ Mệnh (quái 1, 3, 4, 9) và Tây Tứ Mệnh (quái 2, 6, 7, 8). Mỗi Mệnh Quái có bốn hướng cát và bốn hướng hung. Bốn sao cát nên được giải thích theo mục đích chứ không coi một hướng luôn tốt tuyệt đối: Sinh Khí thiên về sinh lực, phát triển và sự hanh thông; Thiên Y thiên về sức khỏe, hồi phục và sự nâng đỡ; Diên Niên thiên về hòa hợp, quan hệ và tính bền lâu; Phục Vị thiên về ổn định, tĩnh tại và củng cố nội tâm. Bốn sao hung gồm Tuyệt Mệnh, Ngũ Quỷ, Lục Sát và Họa Hại là các nhãn phân loại trong truyền thống, không phải dự đoán chắc chắn về tai họa. Khi trả lời hướng mộ, bảng hướng Bát Trạch từ công cụ là lớp xếp hạng hướng chính.',
    'faq',
    'system_research',
    'Eight Mansions background: https://www.8mansions.com/8-mansions-feng-shui ; Ba Zhai overview: https://baguame.com/kb/personal-feng-shui/ba-zhai/ ; contextual academic discussion of Eight Mansions: https://www.academia.edu/35599935/THE_USE_OF_DIFFERENT_METRICS_OR_FENG_SHUI_FORMULAE_FOR_DIFFERENT_PARTS_OF_THE_BUILT_ENVIRONMENT',
    'global',
    NULL,
    'spiritual:bat_trach_method',
    'active',
    'Curated system seed for consistent Bat-Trach direction explanations.',
    'system',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'spiritual-wuxing-layering-v1',
    'spiritual_consultation',
    'Ngũ Hành tương sinh tương khắc phải là lớp giải thích phụ, không được mâu thuẫn Bát Trạch',
    'Ngũ Hành/Wuxing dùng các quan hệ tương sinh và tương khắc như một mô hình biểu tượng truyền thống: Mộc sinh Hỏa, Hỏa sinh Thổ, Thổ sinh Kim, Kim sinh Thủy, Thủy sinh Mộc; và Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim, Kim khắc Mộc. Trong trợ lý này, Nạp Âm và Ngũ Hành chỉ là lớp diễn giải phụ cho tư vấn hướng. Không được suy thẳng từ câu như "Kim khắc Mộc" thành "người mệnh Mộc phải tránh Tây/Tây Bắc" nếu chính bảng Bát Trạch của Mệnh Quái đang xếp Tây hoặc Tây Bắc vào nhóm cát. Khi hai lớp cho cảm giác khác nhau, phải nói rõ đây là hai hệ quy chiếu khác nhau, giữ Bát Trạch làm cơ sở xếp hướng và dùng Ngũ Hành để bổ sung sắc thái, tuyệt đối không vừa khuyên vừa cấm cùng một hướng.',
    'faq',
    'system_research',
    'Wuxing generative and overcoming cycles: https://en.wikipedia.org/wiki/Wuxing_%28Chinese_philosophy%29 ; Eight Mansions deeper-use caution: https://www.joeyyap.com/tutorial/tutorial-details.asp?tid=37',
    'global',
    NULL,
    'spiritual:wuxing_layering',
    'active',
    'Curated system seed added specifically to prevent contradictory advice between Nap-Am/Wuxing and Bat-Trach direction results.',
    'system',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'spiritual-yin-feng-shui-site-v1',
    'spiritual_consultation',
    'Âm trạch: tách hướng cá nhân khỏi đánh giá thực địa của phần mộ',
    'Trong lịch sử và thực hành văn hóa, phong thủy/geomancy từng được dùng để lựa chọn và định hướng vị trí mộ; đây thường được gọi là âm trạch/yin-house feng shui. Tuy nhiên hướng hợp theo Mệnh Quái cá nhân không đủ để kết luận toàn bộ chất lượng một khu mộ. Khi tư vấn lô nghĩa trang, trợ lý phải tách hai lớp: (1) lớp tham khảo cá nhân như Bát Trạch, Can Chi, Nạp Âm; (2) dữ liệu thực địa có thể kiểm chứng như hướng lô, khu, kích thước, giá, trạng thái, lối tiếp cận và những dữ liệu địa hình/cảnh quan mà hệ thống thực sự lưu. Nếu backend không có dữ liệu về núi, nước, độ dốc, thoát nước, nắng, gió, thủy khẩu, long mạch hoặc cảnh quan thì phải nói là chưa đủ dữ liệu, không được tự suy đoán. Với quyết định mua lô, các yếu tố thực tế và nhu cầu gia đình vẫn phải được trình bày song song với phần văn hóa/tâm linh.',
    'faq',
    'system_research',
    'Cambridge University Press, geomancers selecting sites for buildings and graves: https://www.cambridge.org/core/books/communism-in-an-enchanted-world/geomancers-and-yinyang-masters/401161443B3DFF6B86DFA4E0506D3131 ; burial/feng-shui historical study: https://eprints.whiterose.ac.uk/id/eprint/159567/8/YRen_burial_feng_shui_2.20_final.pdf',
    'global',
    NULL,
    'spiritual:yin_feng_shui_site',
    'active',
    'Curated cultural-history seed; factual site claims remain backend-grounded.',
    'system',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'spiritual-consultation-response-v1',
    'spiritual_consultation',
    'Cấu trúc tư vấn phong thủy sâu cho AI Concierge',
    'Khi người dùng yêu cầu tư vấn sâu về Can Chi, Bát Trạch, Bát Tự hoặc hướng mộ, câu trả lời nên lần lượt: nêu dữ liệu đầu vào đã có; nói rõ công cụ thực sự tính gì; giải thích Can Chi năm sinh và Nạp Âm; giải thích Cung Mệnh/Tứ Mệnh; phân tích cả bốn hướng cát với tên sao và ý nghĩa, không chỉ nêu một hướng; phân tích cả bốn hướng cần hạn chế; giải thích Ngũ Hành như lớp phụ và xử lý rõ nếu có xung đột với Bát Trạch; chuyển kết quả sang bối cảnh chọn lô bằng đúng dữ liệu lô đã xác thực; nêu điểm chưa đủ dữ liệu hoặc giới hạn phép tính; kết thúc bằng một câu hỏi tiếp nối đúng chủ đề. Không được dùng ngôn ngữ tuyệt đối như "chắc chắn phát tài", "gây tai họa", "đại hung chắc chắn" hoặc biến tư vấn tâm linh thành áp lực mua hàng. Luôn nói đây là tham khảo văn hóa/tâm linh và để người dùng tự cân nhắc cùng yếu tố thực tế.',
    'faq',
    'system',
    'Cemetery Concierge response policy derived from the curated Bat-Trach/Bazi/Wuxing/Yin-feng-shui records in this migration.',
    'global',
    NULL,
    'spiritual:consultation_response',
    'active',
    'System response-quality policy for culturally grounded and non-contradictory consultation.',
    'system',
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (knowledge_key) DO UPDATE
SET category = EXCLUDED.category,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    knowledge_type = EXCLUDED.knowledge_type,
    source_type = EXCLUDED.source_type,
    source_reference = EXCLUDED.source_reference,
    scope = EXCLUDED.scope,
    owner_user_id = EXCLUDED.owner_user_id,
    memory_key = EXCLUDED.memory_key,
    validation_status = EXCLUDED.validation_status,
    validation_reason = EXCLUDED.validation_reason,
    source_role = EXCLUDED.source_role,
    is_active = TRUE,
    effective_from = COALESCE(ai_knowledge_entries.effective_from, EXCLUDED.effective_from),
    effective_to = NULL,
    updated_at = NOW();


INSERT INTO ai_knowledge_entries
  (knowledge_key, category, title, content, knowledge_type, source_type,
   source_reference, scope, owner_user_id, memory_key, validation_status,
   validation_reason, source_role, is_active, effective_from, updated_at)
VALUES
  (
    'spiritual-luopan-24-mountains-v1',
    'spiritual_consultation',
    'La bàn 24 Sơn: lớp hiển thị chi tiết và giới hạn dữ liệu góc',
    'La bàn phong thủy truyền thống thường có vòng 24 phương vị/24 Sơn, tức 360 độ được chia thành 24 cung khoảng 15 độ; mỗi một trong tám hướng lớn được chia thành ba phần. Đây là lớp phương vị chi tiết hơn tám hướng cơ bản. Trong giao diện Vĩnh Phúc Viên, vòng 24 Sơn có thể dùng để minh họa/giải thích cấu trúc la bàn. Tuy nhiên nếu backend của một lô chỉ lưu hướng thô như Bắc, Đông Bắc, Đông, Đông Nam, Nam, Tây Nam, Tây, Tây Bắc mà không có bearing/góc đo xác thực, trợ lý không được tự gán lô vào một Sơn cụ thể như Tý, Quý, Sửu, Cấn, Dần... Muốn phân tích 24 Sơn thật sự cần số đo phương vị đủ chính xác và quy ước đo hướng rõ ràng. Vì vậy UI 24 Sơn không đồng nghĩa hệ thống đã có dữ liệu để luận 24 Sơn cho từng lô.',
    'faq',
    'system_research',
    'Luopan commonly uses 24 directions / 15 degrees each: https://en.wikipedia.org/wiki/Luopan ; 24 Mountains overview: https://www.fengshuiweb.co.uk/24mountains/',
    'global',
    NULL,
    'spiritual:luopan_24_mountains',
    'active',
    'Curated system seed to prevent the decorative/educational 24-Sơn UI from being mistaken for verified 15-degree plot-bearing data.',
    'system',
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (knowledge_key) DO UPDATE
SET category = EXCLUDED.category,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    knowledge_type = EXCLUDED.knowledge_type,
    source_type = EXCLUDED.source_type,
    source_reference = EXCLUDED.source_reference,
    scope = EXCLUDED.scope,
    owner_user_id = EXCLUDED.owner_user_id,
    memory_key = EXCLUDED.memory_key,
    validation_status = EXCLUDED.validation_status,
    validation_reason = EXCLUDED.validation_reason,
    source_role = EXCLUDED.source_role,
    is_active = TRUE,
    effective_from = COALESCE(ai_knowledge_entries.effective_from, EXCLUDED.effective_from),
    effective_to = NULL,
    updated_at = NOW();

INSERT INTO ai_knowledge_versions
  (version_name, entity_type, entity_id, field_name, new_value, change_reason,
   version_number, action_type, actor_role, validation_reason)
VALUES
  (
    'kb-spiritual-v1',
    'knowledge_seed',
    NULL,
    'spiritual_consultation',
    jsonb_build_object(
      'knowledgeKeys', jsonb_build_array(
        'spiritual-bazi-scope-v1',
        'spiritual-bat-trach-method-v1',
        'spiritual-wuxing-layering-v1',
        'spiritual-yin-feng-shui-site-v1',
        'spiritual-luopan-24-mountains-v1',
        'spiritual-consultation-response-v1'
      )
    ),
    'Seed curated Bát Trạch/Bát Tự/Ngũ Hành/âm-trạch consultation knowledge and retrieval grounding.',
    1,
    'created',
    'system',
    'Curated research-backed cultural reference; factual plot/site claims remain backend-grounded.'
  )
ON CONFLICT (version_name) DO NOTHING;
