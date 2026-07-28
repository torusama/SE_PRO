# Findings

- Customer feedback is persisted in PostgreSQL table `ai_feedback` with message/conversation/user linkage, feedback type, rating, correction, reason, evidence, validation status, reviewer, and applied timestamps.
- Feedback is not accepted blindly. New rows start `pending`; an admin must approve or reject them.
- Approved `bad_recommendation` feedback creates an approved row in `ai_training_samples`, but its current features/label are deterministic placeholders rather than features recovered from the actual recommendation.
- An approved feedback item with corrected content is only incorporated when the reviewer requests `applyCorrection`.
- Applied corrections create/update an active `ai_knowledge_entries` row, append an `ai_knowledge_versions` record, append an `audit_logs` record, and change feedback status to `applied`.
- `TrainingService.learningHistory()` reads `ai_knowledge_versions`; this is the implemented “learning history” API, not a free-form autonomous agent diary.
- Ranker retraining is explicit/admin-triggered and depends on an external ML service plus a minimum-sample/deploy gate. It is not online learning after every user click.
