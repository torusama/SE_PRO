-- A one-off Bát Tự/phong-thủy request is an action for the current turn, not
-- a durable consultation preference. Retire records created by the older,
-- overly broad "I want" detector while preserving genuinely future-scoped
-- preferences such as "từ giờ" or "lần sau".
WITH transient_consultation_memories AS (
  SELECT e.knowledge_entry_id
  FROM ai_knowledge_entries e
  JOIN ai_messages m ON m.message_id = e.source_message_id
  WHERE e.scope = 'user'
    AND e.knowledge_type = 'user_preference'
    AND e.memory_key = 'consultation_topic_preference'
    AND e.validation_status = 'active'
    AND e.is_active = TRUE
    AND (
      LOWER(m.content) ~ '(muốn|muon).*(xem|tư vấn|tu van).*(bát tự|bat tu|phong thủy|phong thuy|tâm linh|tam linh)'
      OR LOWER(m.content) ~ '(xem|tư vấn|tu van).*(bát tự|bat tu).*(ngày sinh|ngay sinh)'
    )
    AND LOWER(m.content) !~ '(ghi nhớ|ghi nho|nhớ giúp|nho giup|lưu lại|luu lai|từ giờ|tu gio|sau này|sau nay|về sau|ve sau|lần sau|lan sau|mọi lần|moi lan|trong tương lai|trong tuong lai)'
)
UPDATE ai_knowledge_entries e
SET is_active = FALSE,
    validation_status = 'rejected',
    validation_reason = 'Retired because the source was a current consultation request, not an explicit durable preference.',
    effective_to = COALESCE(e.effective_to, NOW()),
    updated_at = NOW()
FROM transient_consultation_memories transient
WHERE e.knowledge_entry_id = transient.knowledge_entry_id;
