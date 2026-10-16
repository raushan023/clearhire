CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    created_by UUID NOT NULL
        REFERENCES users(id),

    -- Basic information
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,

    employment_type VARCHAR(30) NOT NULL
        CHECK (
            employment_type IN (
                'full_time',
                'part_time',
                'contract',
                'internship'
            )
        ),

    work_mode VARCHAR(20) NOT NULL
        CHECK (
            work_mode IN (
                'remote',
                'hybrid',
                'onsite'
            )
        ),

    -- Location
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) NOT NULL,

    -- Experience
    experience_min NUMERIC(4,1) NOT NULL,
    experience_max NUMERIC(4,1) NOT NULL,

    -- Compensation
    salary_min BIGINT NOT NULL,
    salary_max BIGINT NOT NULL,
    salary_currency CHAR(3) NOT NULL,
    salary_period VARCHAR(20) NOT NULL DEFAULT 'yearly'
        CHECK (
            salary_period IN (
                'hourly',
                'monthly',
                'yearly'
            )
        ),

    -- Hiring information
    openings INTEGER NOT NULL DEFAULT 1,

    application_deadline TIMESTAMPTZ NOT NULL,
    decision_deadline TIMESTAMPTZ NOT NULL,

    -- Lifecycle
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'open',
                'applications_closed',
                'hiring_in_progress',
                'filled',
                'expired',
                'cancelled'
            )
        ),

    -- Repost lineage
    parent_job_id UUID
        REFERENCES jobs(id),

    -- Duplicate detection
    content_hash VARCHAR(64),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (experience_min >= 0),
    CHECK (experience_max >= experience_min),

    CHECK (salary_min >= 0),
    CHECK (salary_max >= salary_min),

    CHECK (openings > 0),

    CHECK (decision_deadline > application_deadline)
);

CREATE INDEX idx_jobs_company_id
    ON jobs(company_id);

CREATE INDEX idx_jobs_status
    ON jobs(status);

CREATE INDEX idx_jobs_application_deadline
    ON jobs(application_deadline);

CREATE INDEX idx_jobs_created_at
    ON jobs(created_at DESC);

CREATE INDEX idx_jobs_parent_job_id
    ON jobs(parent_job_id);

CREATE INDEX idx_jobs_title_trgm
    ON jobs USING GIN (title gin_trgm_ops);