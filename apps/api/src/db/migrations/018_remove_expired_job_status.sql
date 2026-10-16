ALTER TABLE jobs
DROP CONSTRAINT jobs_status_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_status_check
CHECK (
    status IN (
        'draft',
        'open',
        'applications_closed',
        'hiring_in_progress',
        'filled',
        'cancelled'
    )
);