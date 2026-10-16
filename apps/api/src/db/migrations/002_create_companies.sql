CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,
    website VARCHAR(255),
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('owner', 'recruiter')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (company_id, user_id)
);


CREATE INDEX idx_company_members_company_id
    ON company_members(company_id);

CREATE INDEX idx_company_members_user_id
    ON company_members(user_id);