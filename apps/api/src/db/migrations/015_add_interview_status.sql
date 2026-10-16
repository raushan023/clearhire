ALTER TABLE interviews
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (
        status IN (
            'scheduled',
            'cancelled'
        )
    ),
ADD COLUMN cancelled_at TIMESTAMPTZ,
ADD COLUMN cancelled_by UUID
    REFERENCES users(id);