CREATE TABLE job_status_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    changed_by UUID
        REFERENCES users(id),

    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,

    source VARCHAR(20) NOT NULL
        CHECK (
            source IN (
                'employer',
                'system'
            )
        ),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        from_status IS NULL
        OR from_status IN (
            'draft',
            'open',
            'applications_closed',
            'hiring_in_progress',
            'filled',
            'cancelled'
        )
    ),

    CHECK (
        to_status IN (
            'draft',
            'open',
            'applications_closed',
            'hiring_in_progress',
            'filled',
            'cancelled'
        )
    )
);

CREATE INDEX idx_job_status_events_job_id
    ON job_status_events(job_id);

CREATE INDEX idx_job_status_events_created_at
    ON job_status_events(created_at);