CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    candidate_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'applied'
        CHECK (
            status IN (
                'applied',
                'under_review',
                'shortlisted',
                'interview',
                'final_review',
                'offer',
                'rejected',
                'withdrawn'
            )
        ),

    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (job_id, candidate_id)
);


CREATE INDEX idx_applications_job_id
    ON applications(job_id);

CREATE INDEX idx_applications_candidate_id
    ON applications(candidate_id);

CREATE INDEX idx_applications_status
    ON applications(status);


CREATE TABLE application_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id UUID NOT NULL
        REFERENCES applications(id)
        ON DELETE CASCADE,

    changed_by UUID NOT NULL
        REFERENCES users(id),

    from_status VARCHAR(30),

    to_status VARCHAR(30) NOT NULL,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        from_status IS NULL
        OR from_status IN (
            'applied',
            'under_review',
            'shortlisted',
            'interview',
            'final_review',
            'offer',
            'rejected',
            'withdrawn'
        )
    ),

    CHECK (
        to_status IN (
            'applied',
            'under_review',
            'shortlisted',
            'interview',
            'final_review',
            'offer',
            'rejected',
            'withdrawn'
        )
    )
);


CREATE INDEX idx_application_events_application_id
    ON application_events(application_id);

CREATE INDEX idx_application_events_created_at
    ON application_events(created_at);