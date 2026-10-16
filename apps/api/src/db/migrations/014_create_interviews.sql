CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id UUID NOT NULL
        REFERENCES applications(id)
        ON DELETE CASCADE,

    scheduled_by UUID NOT NULL
        REFERENCES users(id),

    scheduled_at TIMESTAMPTZ NOT NULL,

    mode VARCHAR(20) NOT NULL
        CHECK (
            mode IN (
                'video',
                'phone',
                'onsite'
            )
        ),

    meeting_link TEXT,
    location TEXT,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        (mode = 'video' AND meeting_link IS NOT NULL)
        OR
        (mode = 'onsite' AND location IS NOT NULL)
        OR
        (mode = 'phone')
    )
);

CREATE INDEX idx_interviews_application_id
    ON interviews(application_id);

CREATE INDEX idx_interviews_scheduled_at
    ON interviews(scheduled_at);