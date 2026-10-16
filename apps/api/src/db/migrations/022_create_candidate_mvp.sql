CREATE TABLE candidate_profiles (
    candidate_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline VARCHAR(150),
    summary TEXT,
    total_experience NUMERIC(4,1) CHECK (total_experience >= 0),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    current_company VARCHAR(150),
    current_title VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE candidate_profile_skills (
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(candidate_id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id),
    PRIMARY KEY (candidate_id, skill_id)
);
CREATE TABLE saved_jobs (
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (candidate_id, job_id)
);
CREATE INDEX idx_saved_jobs_candidate_created ON saved_jobs(candidate_id, created_at DESC);
-- Storage keys stay private. A single row per candidate is the active resume.
CREATE TABLE candidate_resumes (
    candidate_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    storage_key TEXT NOT NULL UNIQUE,
    filename VARCHAR(150) NOT NULL,
    media_type VARCHAR(100) NOT NULL CHECK (media_type = 'application/pdf'),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
