CREATE TABLE job_change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    changed_by UUID NOT NULL
        REFERENCES users(id),

    field_name VARCHAR(100) NOT NULL,

    old_value TEXT,
    new_value TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_change_events_job_id
    ON job_change_events(job_id);

CREATE INDEX idx_job_change_events_created_at
    ON job_change_events(created_at DESC);