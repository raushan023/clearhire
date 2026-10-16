CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL,

    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    job_id UUID
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    application_id UUID
        REFERENCES applications(id)
        ON DELETE CASCADE,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_notifications_user_id
    ON notifications(user_id);

CREATE INDEX idx_notifications_user_created_at
    ON notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_unread
    ON notifications(user_id)
    WHERE read_at IS NULL;

CREATE UNIQUE INDEX idx_notifications_feedback_overdue_unique
ON notifications(user_id, job_id, type)
WHERE type = 'feedback_overdue';