-- =========================================================
-- SKILLS
-- =========================================================

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (normalized_name)
);


CREATE TABLE job_skills (
    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    skill_id UUID NOT NULL
        REFERENCES skills(id)
        ON DELETE CASCADE,

    skill_type VARCHAR(20) NOT NULL
        CHECK (
            skill_type IN (
                'required',
                'preferred'
            )
        ),

    PRIMARY KEY (job_id, skill_id)
);


CREATE INDEX idx_job_skills_skill_id
    ON job_skills(skill_id);


-- =========================================================
-- BENEFITS
-- =========================================================

CREATE TABLE benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (name)
);


CREATE TABLE job_benefits (
    job_id UUID NOT NULL
        REFERENCES jobs(id)
        ON DELETE CASCADE,

    benefit_id UUID NOT NULL
        REFERENCES benefits(id)
        ON DELETE CASCADE,

    PRIMARY KEY (job_id, benefit_id)
);


CREATE INDEX idx_job_benefits_benefit_id
    ON job_benefits(benefit_id);

INSERT INTO benefits (name)
VALUES
    ('Health Insurance'),
    ('Provident Fund'),
    ('Gratuity'),
    ('Performance Bonus'),
    ('Joining Bonus'),
    ('ESOP'),
    ('Paid Leave'),
    ('Remote Work Allowance'),
    ('Relocation Assistance');