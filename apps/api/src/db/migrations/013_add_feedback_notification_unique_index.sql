CREATE UNIQUE INDEX idx_notifications_feedback_overdue_unique
ON notifications(user_id, job_id, type)
WHERE type = 'feedback_overdue';