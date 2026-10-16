ALTER TABLE jobs
ADD COLUMN applications_closed_at TIMESTAMPTZ,
ADD COLUMN applications_closed_by VARCHAR(20)
    CHECK (
        applications_closed_by IS NULL
        OR applications_closed_by IN (
            'employer',
            'system'
        )
    );