DROP INDEX IF EXISTS idx_notifications_feedback_overdue_unique;

CREATE UNIQUE INDEX idx_notifications_feedback_compliance_unique
ON notifications(user_id, job_id, type)
WHERE type IN (
    'feedback_overdue',
    'feedback_overdue_24h',
    'feedback_overdue_72h'
);