-- Historical bootstrap repair: 012 already creates this index. Before the first
-- stable baseline, make 013 idempotent so fresh installs can reach 020.
-- Already-applied filenames are skipped; this does not change deployed schemas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_feedback_overdue_unique
ON notifications(user_id, job_id, type)
WHERE type = 'feedback_overdue';