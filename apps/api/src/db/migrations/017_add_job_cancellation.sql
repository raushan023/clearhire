ALTER TABLE jobs
ADD COLUMN cancelled_at TIMESTAMPTZ,
ADD COLUMN cancelled_by UUID
    REFERENCES users(id),
ADD COLUMN cancellation_reason TEXT;