import { missedDeadlineValue } from "./job-accountability.service.js";
import { protectActiveJobContent } from "./job-duplicate.service.js";
import { pool } from "../../config/database.js";
import type { PoolClient } from "pg";
import { getCompanyMembership } from "../company/company.service.js";

import type { CreateJobInput, JobSearchInput, UpdateJobInput, EmployerJobSearchInput, UpdateJobStatusInput, CancelJobInput, RepostJobInput } from "./job.schema.js";


export async function createJob(
    userId: string,
    input: CreateJobInput
) {
    const membership = await getCompanyMembership(
        userId,
        input.companyId
    );

    if (!membership) {
        throw new Error("COMPANY_ACCESS_DENIED");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const jobResult = await client.query(
            `
            INSERT INTO jobs (
                company_id,
                created_by,
                title,
                description,
                employment_type,
                work_mode,
                city,
                state,
                country,
                experience_min,
                experience_max,
                salary_min,
                salary_max,
                salary_currency,
                salary_period,
                openings,
                application_deadline,
                decision_deadline
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12,
                $13, $14, $15, $16, $17, $18
            )
            RETURNING *
        `,
            [
                input.companyId,
                userId,
                input.title,
                input.description,
                input.employmentType,
                input.workMode,
                input.city ?? null,
                input.state ?? null,
                input.country,
                input.experienceMin,
                input.experienceMax,
                input.salaryMin,
                input.salaryMax,
                input.salaryCurrency,
                input.salaryPeriod,
                input.openings,
                input.applicationDeadline,
                input.decisionDeadline,
            ]
        );

        const job = jobResult.rows[0];

        for (const skillId of input.requiredSkillIds) {
            await client.query(
                `
                    INSERT INTO job_skills (
                        job_id,
                        skill_id,
                        skill_type
                    )
                    VALUES ($1, $2, 'required')
                `,
                [job.id, skillId]
            );
        }

        for (const skillId of input.preferredSkillIds) {
            await client.query(
                `
                    INSERT INTO job_skills (
                        job_id,
                        skill_id,
                        skill_type
                    )
                    VALUES ($1, $2, 'preferred')
                `,
                [job.id, skillId]
            );
        }

        for (const benefitId of input.benefitIds) {
            await client.query(
                `
                    INSERT INTO job_benefits (
                        job_id,
                        benefit_id
                    )
                    VALUES ($1, $2)
                `,
                [job.id, benefitId]
            );
        }

        await client.query("COMMIT");

        return {
            id: job.id,
            companyId: job.company_id,
            createdBy: job.created_by,
            title: job.title,
            description: job.description,
            employmentType: job.employment_type,
            workMode: job.work_mode,
            city: job.city,
            state: job.state,
            country: job.country,
            experienceMin: Number(job.experience_min),
            experienceMax: Number(job.experience_max),
            salaryMin: Number(job.salary_min),
            salaryMax: Number(job.salary_max),
            salaryCurrency: job.salary_currency,
            salaryPeriod: job.salary_period,
            openings: job.openings,
            applicationDeadline: job.application_deadline,
            decisionDeadline: job.decision_deadline,
            status: job.status,
            createdAt: job.created_at,
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function publishJob(
    userId: string,
    jobId: string
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const jobResult = await client.query(
            `
                SELECT
                    j.id,
                    j.company_id,
                    j.status,
                    j.application_deadline
                FROM jobs j

                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id

                WHERE j.id = $1
                  AND cm.user_id = $2

                FOR UPDATE OF j
            `,
            [
                jobId,
                userId,
            ]
        );

        const job = jobResult.rows[0];

        if (!job) {
            throw new Error(
                "JOB_ACCESS_DENIED"
            );
        }

        if (job.status !== "draft") {
            throw new Error(
                "JOB_NOT_DRAFT"
            );
        }

        if (
            new Date(
                job.application_deadline
            ).getTime() <= Date.now()
        ) {
            throw new Error(
                "APPLICATION_DEADLINE_PASSED"
            );
        }

        const requiredSkillsResult =
            await client.query(
                `
                    SELECT
                        COUNT(*)::int AS count
                    FROM job_skills
                    WHERE job_id = $1
                      AND skill_type = 'required'
                `,
                [jobId]
            );

        const requiredSkillCount =
            requiredSkillsResult.rows[0].count;

        if (requiredSkillCount < 1) {
            throw new Error(
                "JOB_INCOMPLETE"
            );
        }

        await protectActiveJobContent(client, jobId);

        const result = await client.query(
            `
                UPDATE jobs
                SET
                    status = 'open',
                    updated_at = NOW()
                WHERE id = $1
                  AND status = 'draft'
                RETURNING
                    id,
                    company_id,
                    title,
                    status,
                    application_deadline,
                    decision_deadline,
                    updated_at
            `,
            [jobId]
        );

        if (result.rowCount === 0) {
            throw new Error(
                "JOB_NOT_DRAFT"
            );
        }

        await client.query(
            `
                INSERT INTO job_status_events (
                    job_id,
                    changed_by,
                    from_status,
                    to_status,
                    source
                )
                VALUES (
                    $1,
                    $2,
                    'draft',
                    'open',
                    'employer'
                )
            `,
            [
                jobId,
                userId,
            ]
        );

        await client.query("COMMIT");

        const publishedJob =
            result.rows[0];

        return {
            id: publishedJob.id,
            companyId:
                publishedJob.company_id,
            title:
                publishedJob.title,
            status:
                publishedJob.status,
            applicationDeadline:
                publishedJob.application_deadline,
            decisionDeadline:
                publishedJob.decision_deadline,
            updatedAt:
                publishedJob.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");

        throw error;
    } finally {
        client.release();
    }
}

async function recordJobChange(
    client: PoolClient,
    jobId: string,
    userId: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown
) {
    if (
        JSON.stringify(oldValue) === JSON.stringify(newValue)
    ) {
        return;
    }

    await client.query(
        `
            INSERT INTO job_change_events (
                job_id,
                changed_by,
                field_name,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5)
        `,
        [
            jobId,
            userId,
            fieldName,
            JSON.stringify(oldValue),
            JSON.stringify(newValue),
        ]
    );
}

export async function updateJob(
    userId: string,
    jobId: string,
    input: UpdateJobInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const jobResult = await client.query(
            `
                SELECT j.*
                FROM jobs j
                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id
                WHERE j.id = $1
                  AND cm.user_id = $2
                FOR UPDATE OF j
            `,
            [jobId, userId]
        );

        const job = jobResult.rows[0];

        if (!job) {
            throw new Error("JOB_ACCESS_DENIED");
        }

        if (!["draft", "open"].includes(job.status)) {
            throw new Error("JOB_NOT_EDITABLE");
        }

        const experienceMin =
            input.experienceMin ??
            Number(job.experience_min);

        const experienceMax =
            input.experienceMax ??
            Number(job.experience_max);

        const salaryMin =
            input.salaryMin ??
            Number(job.salary_min);

        const salaryMax =
            input.salaryMax ??
            Number(job.salary_max);

        const applicationDeadline =
            input.applicationDeadline ??
            new Date(job.application_deadline);

        const decisionDeadline =
            input.decisionDeadline ??
            new Date(job.decision_deadline);

        if (experienceMax < experienceMin) {
            throw new Error("INVALID_EXPERIENCE_RANGE");
        }

        if (salaryMax < salaryMin) {
            throw new Error("INVALID_SALARY_RANGE");
        }

        if (decisionDeadline <= applicationDeadline) {
            throw new Error("INVALID_DEADLINE_RANGE");
        }

        if (
            job.status === "open" &&
            applicationDeadline.getTime() <= Date.now()
        ) {
            throw new Error("INVALID_APPLICATION_DEADLINE");
        }

        const title =
            input.title ?? job.title;

        const description =
            input.description ?? job.description;

        const employmentType =
            input.employmentType ?? job.employment_type;

        const workMode =
            input.workMode ?? job.work_mode;

        const city =
            input.city ?? job.city;

        const state =
            input.state ?? job.state;

        const country =
            input.country ?? job.country;

        const salaryCurrency =
            input.salaryCurrency ?? job.salary_currency;

        const salaryPeriod =
            input.salaryPeriod ?? job.salary_period;

        const openings =
            input.openings ?? job.openings;

        if (job.status === "open" && input.openings !== undefined) {
            const occupied = await client.query(
                "SELECT COUNT(*)::int AS count FROM applications WHERE job_id = $1 AND status IN ('offer', 'offer_accepted')",
                [jobId]
            );
            if (openings < occupied.rows[0].count) throw new Error("OPENINGS_BELOW_OCCUPIED_CAPACITY");
        }

        const skillResult = await client.query(
            `
                SELECT
                    js.skill_id,
                    js.skill_type,
                    s.name
                FROM job_skills js
                INNER JOIN skills s
                    ON s.id = js.skill_id
                WHERE js.job_id = $1
                ORDER BY s.name
            `,
            [jobId]
        );

        const benefitResult = await client.query(
            `
                SELECT
                    jb.benefit_id,
                    b.name
                FROM job_benefits jb
                INNER JOIN benefits b
                    ON b.id = jb.benefit_id
                WHERE jb.job_id = $1
                ORDER BY b.name
            `,
            [jobId]
        );

        const currentRequired =
            skillResult.rows.filter(
                (row) => row.skill_type === "required"
            );

        const currentPreferred =
            skillResult.rows.filter(
                (row) => row.skill_type === "preferred"
            );

        const requiredSkillIds =
            input.requiredSkillIds ??
            currentRequired.map((row) => row.skill_id);

        const preferredSkillIds =
            input.preferredSkillIds ??
            currentPreferred.map((row) => row.skill_id);

        const benefitIds =
            input.benefitIds ??
            benefitResult.rows.map(
                (row) => row.benefit_id
            );

        if (requiredSkillIds.length === 0) {
            throw new Error("REQUIRED_SKILL_MISSING");
        }

        if (
            new Set(requiredSkillIds).size !==
            requiredSkillIds.length
        ) {
            throw new Error("DUPLICATE_SKILLS");
        }

        if (
            new Set(preferredSkillIds).size !==
            preferredSkillIds.length
        ) {
            throw new Error("DUPLICATE_SKILLS");
        }

        const requiredSet = new Set(requiredSkillIds);

        if (
            preferredSkillIds.some(
                (id) => requiredSet.has(id)
            )
        ) {
            throw new Error("SKILL_TYPE_CONFLICT");
        }

        const updatedJobResult = await client.query(
            `
                UPDATE jobs
                SET
                    decision_deadline_missed_at = ${missedDeadlineValue},
                    title = $1,
                    description = $2,
                    employment_type = $3,
                    work_mode = $4,
                    city = $5,
                    state = $6,
                    country = $7,
                    experience_min = $8,
                    experience_max = $9,
                    salary_min = $10,
                    salary_max = $11,
                    salary_currency = $12,
                    salary_period = $13,
                    openings = $14,
                    application_deadline = $15,
                    decision_deadline = $16,
                    updated_at = NOW()
                WHERE id = $17
                RETURNING *
            `,
            [
                title,
                description,
                employmentType,
                workMode,
                city,
                state,
                country,
                experienceMin,
                experienceMax,
                salaryMin,
                salaryMax,
                salaryCurrency,
                salaryPeriod,
                openings,
                applicationDeadline,
                decisionDeadline,
                jobId,
            ]
        );

        if (
            input.requiredSkillIds !== undefined ||
            input.preferredSkillIds !== undefined
        ) {
            await client.query(
                `DELETE FROM job_skills WHERE job_id = $1`,
                [jobId]
            );

            for (const skillId of requiredSkillIds) {
                await client.query(
                    `
                        INSERT INTO job_skills (
                            job_id,
                            skill_id,
                            skill_type
                        )
                        VALUES ($1, $2, 'required')
                    `,
                    [jobId, skillId]
                );
            }

            for (const skillId of preferredSkillIds) {
                await client.query(
                    `
                        INSERT INTO job_skills (
                            job_id,
                            skill_id,
                            skill_type
                        )
                        VALUES ($1, $2, 'preferred')
                    `,
                    [jobId, skillId]
                );
            }
        }

        if (input.benefitIds !== undefined) {
            await client.query(
                `DELETE FROM job_benefits WHERE job_id = $1`,
                [jobId]
            );

            for (const benefitId of benefitIds) {
                await client.query(
                    `
                        INSERT INTO job_benefits (
                            job_id,
                            benefit_id
                        )
                        VALUES ($1, $2)
                    `,
                    [jobId, benefitId]
                );
            }
        }

        if (job.status === "open") {
            await recordJobChange(
                client,
                jobId,
                userId,
                "title",
                job.title,
                title
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "description",
                job.description,
                description
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "employment_type",
                job.employment_type,
                employmentType
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "work_mode",
                job.work_mode,
                workMode
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "location",
                {
                    city: job.city,
                    state: job.state,
                    country: job.country,
                },
                {
                    city,
                    state,
                    country,
                }
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "experience_range",
                {
                    min: Number(job.experience_min),
                    max: Number(job.experience_max),
                },
                {
                    min: experienceMin,
                    max: experienceMax,
                }
            );
            await recordJobChange(
                client,
                jobId,
                userId,
                "salary_range",
                {
                    min: Number(job.salary_min),
                    max: Number(job.salary_max),
                    currency: job.salary_currency,
                    period: job.salary_period,
                },
                {
                    min: salaryMin,
                    max: salaryMax,
                    currency: salaryCurrency,
                    period: salaryPeriod,
                }
            );
            await recordJobChange(
                client,
                jobId,
                userId,
                "openings",
                job.openings,
                openings
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "application_deadline",
                job.application_deadline,
                applicationDeadline
            );

            await recordJobChange(
                client,
                jobId,
                userId,
                "decision_deadline",
                job.decision_deadline,
                decisionDeadline
            );
            if (
                input.requiredSkillIds !== undefined ||
                input.preferredSkillIds !== undefined
            ) {
                const updatedSkillsResult =
                    await client.query(
                        `
                            SELECT
                                js.skill_type,
                                s.name
                            FROM job_skills js
                            INNER JOIN skills s
                                ON s.id = js.skill_id
                            WHERE js.job_id = $1
                            ORDER BY s.name
                        `,
                        [jobId]
                    );

                const updatedRequired =
                    updatedSkillsResult.rows
                        .filter(
                            (row) =>
                                row.skill_type === "required"
                        )
                        .map((row) => row.name);

                const updatedPreferred =
                    updatedSkillsResult.rows
                        .filter(
                            (row) =>
                                row.skill_type === "preferred"
                        )
                        .map((row) => row.name);

                await recordJobChange(
                    client,
                    jobId,
                    userId,
                    "required_skills",
                    currentRequired.map(
                        (row) => row.name
                    ),
                    updatedRequired
                );

                await recordJobChange(
                    client,
                    jobId,
                    userId,
                    "preferred_skills",
                    currentPreferred.map(
                        (row) => row.name
                    ),
                    updatedPreferred
                );
            }

            if (input.benefitIds !== undefined) {
                const updatedBenefitsResult =
                    await client.query(
                        `
                            SELECT b.name
                            FROM job_benefits jb
                            INNER JOIN benefits b
                                ON b.id = jb.benefit_id
                            WHERE jb.job_id = $1
                            ORDER BY b.name
                        `,
                        [jobId]
                    );

                await recordJobChange(
                    client,
                    jobId,
                    userId,
                    "benefits",
                    benefitResult.rows.map(
                        (row) => row.name
                    ),
                    updatedBenefitsResult.rows.map(
                        (row) => row.name
                    )
                );
            }
        }
        if (job.status === "open") await protectActiveJobContent(client, jobId);
        await client.query("COMMIT");

        const updated = updatedJobResult.rows[0];
        return {
            id: updated.id, companyId: updated.company_id, title: updated.title,
            description: updated.description, employmentType: updated.employment_type,
            workMode: updated.work_mode, city: updated.city, state: updated.state, country: updated.country,
            experienceMin: Number(updated.experience_min), experienceMax: Number(updated.experience_max),
            salaryMin: Number(updated.salary_min), salaryMax: Number(updated.salary_max),
            salaryCurrency: updated.salary_currency, salaryPeriod: updated.salary_period,
            openings: updated.openings, status: updated.status,
            applicationDeadline: updated.application_deadline, decisionDeadline: updated.decision_deadline,
            createdAt: updated.created_at, updatedAt: updated.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

function parseAuditValue(value: string | null) {
    if (value === null) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export async function getJobById(
    userId: string,
    userRole: "candidate" | "employer",
    jobId: string
) {
    const jobResult = await pool.query(
        `
            SELECT
                j.*,
                c.name AS company_name,
                c.website AS company_website,
                c.description AS company_description
            FROM jobs j
            INNER JOIN companies c
                ON c.id = j.company_id
            WHERE j.id = $1
        `,
        [jobId]
    );

    const job = jobResult.rows[0];

    if (!job) {
        throw new Error("JOB_NOT_FOUND");
    }

    if (job.status !== "open") {
        const access = userRole === "employer"
            ? await getCompanyMembership(userId, job.company_id)
            : job.status !== "draft" && (await pool.query(
                "SELECT 1 FROM applications WHERE job_id = $1 AND candidate_id = $2 UNION ALL SELECT 1 FROM saved_jobs WHERE job_id = $1 AND candidate_id = $2",
                [jobId, userId]
            )).rowCount;
        if (!access) throw new Error("JOB_NOT_ACCESSIBLE");
    }

    const accountabilityResult = await pool.query(
        `
        SELECT
            COUNT(*) FILTER (
                WHERE status IN (
                    'applied',
                    'under_review',
                    'shortlisted',
                    'interview',
                    'final_review',
                    'offer'
                )
            )::int AS awaiting_outcome_count
        FROM applications
        WHERE job_id = $1
    `,
        [jobId]
    );

    const awaitingOutcomeCount = accountabilityResult.rows[0].awaiting_outcome_count;

    const skillsResult = await pool.query(
        `
            SELECT
                s.id,
                s.name,
                js.skill_type
            FROM job_skills js
            INNER JOIN skills s
                ON s.id = js.skill_id
            WHERE js.job_id = $1
            ORDER BY s.name
        `,
        [jobId]
    );

    const requiredSkills = skillsResult.rows
        .filter((skill) => skill.skill_type === "required")
        .map((skill) => ({
            id: skill.id,
            name: skill.name,
        }));

    const preferredSkills = skillsResult.rows
        .filter((skill) => skill.skill_type === "preferred")
        .map((skill) => ({
            id: skill.id,
            name: skill.name,
        }));

    const benefitsResult = await pool.query(
        `
            SELECT
                b.id,
                b.name
            FROM job_benefits jb
            INNER JOIN benefits b
                ON b.id = jb.benefit_id
            WHERE jb.job_id = $1
            ORDER BY b.name
        `,
        [jobId]
    );

    const benefits = benefitsResult.rows.map(benefit => ({ id: benefit.id, name: benefit.name }));

    const historyResult = await pool.query(
        `
            SELECT
                field_name,
                old_value,
                new_value,
                created_at
            FROM job_change_events
            WHERE job_id = $1
            ORDER BY created_at DESC
        `,
        [jobId]
    );

    const changeHistory = historyResult.rows.map((event) => ({
        fieldName: event.field_name,
        oldValue: parseAuditValue(event.old_value),
        newValue: parseAuditValue(event.new_value),
        changedAt: event.created_at,
    }));

    const statusHistoryResult = await pool.query(
        `
        SELECT
            from_status,
            to_status,
            source,
            note,
            created_at
        FROM job_status_events
        WHERE job_id = $1
        ORDER BY created_at ASC
    `,
        [jobId]
    );

    const statusHistory = statusHistoryResult.rows.map(
        (event) => ({
            fromStatus: event.from_status,
            toStatus: event.to_status,
            source: event.source,
            note: event.note,
            createdAt: event.created_at,
        })
    );

    return {
        id: job.id,

        company: {
            id: job.company_id,
            name: job.company_name,
            website: job.company_website,
            description: job.company_description,
        },

        title: job.title,
        description: job.description,

        employmentType: job.employment_type,
        workMode: job.work_mode,

        location: {
            city: job.city,
            state: job.state,
            country: job.country,
        },

        experience: {
            min: Number(job.experience_min),
            max: Number(job.experience_max),
        },

        salary: {
            min: Number(job.salary_min),
            max: Number(job.salary_max),
            currency: job.salary_currency,
            period: job.salary_period,
        },

        openings: job.openings,

        applicationDeadline: job.application_deadline,
        decisionDeadline: job.decision_deadline,
        applicationsClosedAt: job.applications_closed_at,
        applicationsClosedBy: job.applications_closed_by,
        cancelledAt: job.cancelled_at,
        cancellationReason: job.cancellation_reason,
        parentJobId: job.parent_job_id,
        accountability: {
            decisionDeadlineMissed:
                Boolean(
                    job.decision_deadline_missed_at
                ),

            decisionDeadlineMissedAt:
                job.decision_deadline_missed_at,

            candidatesAwaitingOutcome:
                awaitingOutcomeCount,
        },
        status: job.status,

        requiredSkills,
        preferredSkills,
        benefits,

        changeHistory,

        statusHistory,

        createdAt: job.created_at,
        updatedAt: job.updated_at,
    };
}

export async function searchJobs(
    input: JobSearchInput
) {
    const {
        search,
        workMode,
        employmentType,
        country,
        city,
        experienceMin,
        salaryMin,
        skillIds,
        page,
        limit,
    } = input;

    const conditions: string[] = [
        "j.status = 'open'",
        "j.application_deadline > NOW()",
    ];

    const values: unknown[] = [];

    function addValue(value: unknown) {
        values.push(value);
        return `$${values.length}`;
    }

    if (search) {
        const parameter = addValue(`%${search}%`);

        conditions.push(`
            (
                j.title ILIKE ${parameter}
                OR j.description ILIKE ${parameter}
                OR c.name ILIKE ${parameter}
            )
        `);
    }

    if (workMode) {
        const parameter = addValue(workMode);

        conditions.push(
            `j.work_mode = ${parameter}`
        );
    }

    if (employmentType) {
        const parameter = addValue(employmentType);

        conditions.push(
            `j.employment_type = ${parameter}`
        );
    }

    if (country) {
        const parameter = addValue(country);

        conditions.push(
            `LOWER(j.country) = LOWER(${parameter})`
        );
    }

    if (city) {
        const parameter = addValue(city);

        conditions.push(
            `LOWER(j.city) = LOWER(${parameter})`
        );
    }

    if (experienceMin !== undefined) {
        const parameter = addValue(experienceMin);

        conditions.push(
            `j.experience_min <= ${parameter}`
        );
    }

    if (salaryMin !== undefined) {
        const parameter = addValue(salaryMin);

        conditions.push(
            `j.salary_max >= ${parameter}`
        );
    }

    if (skillIds.length > 0) {
        const parameter = addValue(skillIds);

        conditions.push(`
            (
                SELECT COUNT(DISTINCT js.skill_id)
                FROM job_skills js
                WHERE js.job_id = j.id
                  AND js.skill_id = ANY(${parameter}::uuid[])
            ) = ${skillIds.length}
        `);
    }


    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
        `
            SELECT COUNT(*)::int AS total
            FROM jobs j
            INNER JOIN companies c
                ON c.id = j.company_id
            WHERE ${whereClause}
        `,
        values
    );

    const offset = (page - 1) * limit;

    const queryValues = [
        ...values,
        limit,
        offset,
    ];

    const limitParameter =
        `$${values.length + 1}`;

    const offsetParameter =
        `$${values.length + 2}`;

    const result = await pool.query(
        `
            SELECT
                j.id,
                j.title,
                j.employment_type,
                j.work_mode,
                j.city,
                j.state,
                j.country,
                j.experience_min,
                j.experience_max,
                j.salary_min,
                j.salary_max,
                j.salary_currency,
                j.salary_period,
                j.openings,
                j.application_deadline,
                j.decision_deadline,
                j.decision_deadline_missed_at,
                j.created_at,

                c.id AS company_id,
                c.name AS company_name

            FROM jobs j
            INNER JOIN companies c
                ON c.id = j.company_id

            WHERE ${whereClause}

            ORDER BY j.created_at DESC

            LIMIT ${limitParameter}
            OFFSET ${offsetParameter}
        `,
        queryValues
    );

    const jobs = result.rows.map((job) => ({
        id: job.id,
        title: job.title,

        company: {
            id: job.company_id,
            name: job.company_name,
        },

        employmentType: job.employment_type,
        workMode: job.work_mode,

        location: {
            city: job.city,
            state: job.state,
            country: job.country,
        },

        experience: {
            min: Number(job.experience_min),
            max: Number(job.experience_max),
        },

        salary: {
            min: Number(job.salary_min),
            max: Number(job.salary_max),
            currency: job.salary_currency,
            period: job.salary_period,
        },

        openings: job.openings,

        applicationDeadline:
            job.application_deadline,

        decisionDeadline:
            job.decision_deadline,

        decisionDeadlineMissedAt:
            job.decision_deadline_missed_at,

        createdAt: job.created_at,
    }));

    const total = countResult.rows[0].total;

    return {
        jobs,
        pagination: {
            page,
            limit,
            total,
            totalPages:
                Math.ceil(total / limit),
        },
    };
}

export async function getEmployerJobs(
    userId: string,
    input: EmployerJobSearchInput
) {
    const {
        companyId,
        status,
        page,
        limit,
    } = input;

    const conditions: string[] = [
        "cm.user_id = $1",
    ];

    const values: unknown[] = [userId];

    function addValue(value: unknown) {
        values.push(value);
        return `$${values.length}`;
    }

    if (companyId) {
        const parameter = addValue(companyId);

        conditions.push(
            `j.company_id = ${parameter}`
        );
    }

    if (status) {
        const parameter = addValue(status);

        conditions.push(
            `j.status = ${parameter}`
        );
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
        `
            SELECT COUNT(*)::int AS total
            FROM jobs j

            INNER JOIN company_members cm
                ON cm.company_id = j.company_id

            WHERE ${whereClause}
        `,
        values
    );

    const offset = (page - 1) * limit;

    const queryValues = [
        ...values,
        limit,
        offset,
    ];

    const limitParameter =
        `$${values.length + 1}`;

    const offsetParameter =
        `$${values.length + 2}`;

    const result = await pool.query(
        `
            SELECT
                j.id,
                j.title,
                j.status,
                j.openings,
                j.application_deadline,
                j.decision_deadline,
                j.decision_deadline_missed_at,
                j.created_at,
                j.updated_at,

                c.id AS company_id,
                c.name AS company_name,

                COUNT(a.id)::int AS application_count

            FROM jobs j

            INNER JOIN companies c
                ON c.id = j.company_id

            INNER JOIN company_members cm
                ON cm.company_id = j.company_id

            LEFT JOIN applications a
                ON a.job_id = j.id

            WHERE ${whereClause}

            GROUP BY
                j.id,
                c.id,
                c.name

            ORDER BY j.created_at DESC

            LIMIT ${limitParameter}
            OFFSET ${offsetParameter}
        `,
        queryValues
    );

    const jobs = result.rows.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        openings: job.openings,
        applicationCount: job.application_count,

        company: {
            id: job.company_id,
            name: job.company_name,
        },

        applicationDeadline:
            job.application_deadline,

        decisionDeadline:
            job.decision_deadline,

        decisionDeadlineMissedAt:
            job.decision_deadline_missed_at,

        createdAt: job.created_at,
        updatedAt: job.updated_at,
    }));

    const total = countResult.rows[0].total;

    return {
        jobs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

type JobStatus =
    | "draft"
    | "open"
    | "applications_closed"
    | "hiring_in_progress"
    | "filled"
    | "cancelled";

const employerJobTransitions: Record<
    JobStatus,
    JobStatus[]
> = {
    draft: [],
    open: ["applications_closed"],
    applications_closed: ["hiring_in_progress"],
    hiring_in_progress: ["filled"],

    filled: [],
    cancelled: [],
};

export async function updateJobStatus(
    employerId: string,
    jobId: string,
    input: UpdateJobStatusInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
        SELECT
            j.id,
            j.status,
            j.company_id,
            j.openings
        FROM jobs j

        INNER JOIN company_members cm
            ON cm.company_id = j.company_id

        WHERE j.id = $1
          AND cm.user_id = $2

        FOR UPDATE OF j
    `,
            [
                jobId,
                employerId,
            ]
        );

        const job = result.rows[0];

        if (!job) {
            throw new Error("JOB_ACCESS_DENIED");
        }

        const currentStatus =
            job.status as JobStatus;

        const newStatus =
            input.status as JobStatus;

        const allowedTransitions =
            employerJobTransitions[currentStatus];

        if (!allowedTransitions.includes(newStatus)) {
            throw new Error("INVALID_JOB_STATUS_TRANSITION");
        }

        if (newStatus === "filled") {
            const applicationSummaryResult =
                await client.query(
                    `
                SELECT
                    COUNT(*) FILTER (
                        WHERE status NOT IN (
                            'offer_accepted',
                            'offer_declined',
                            'rejected',
                            'withdrawn',
                            'job_cancelled'
                        )
                    )::int AS unresolved_count,

                    COUNT(*) FILTER (
                        WHERE status = 'offer_accepted'
                    )::int AS accepted_count

                FROM applications
                WHERE job_id = $1
            `,
                    [jobId]
                );

            const {
                unresolved_count,
                accepted_count,
            } = applicationSummaryResult.rows[0];

            if (unresolved_count > 0) {
                throw new Error(
                    "UNRESOLVED_APPLICATIONS_EXIST"
                );
            }

            if (accepted_count < job.openings) {
                throw new Error(
                    "OPENINGS_NOT_FILLED"
                );
            }
        }

        const updatedResult = await client.query(
            `
                UPDATE jobs
                SET
                    decision_deadline_missed_at = ${missedDeadlineValue},
                    status = $1,
                    applications_closed_at = CASE WHEN $1 = 'applications_closed' THEN NOW() ELSE applications_closed_at END,
                    applications_closed_by = CASE WHEN $1 = 'applications_closed' THEN 'employer' ELSE applications_closed_by END,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    company_id,
                    title,
                    status,
                    application_deadline,
                    decision_deadline,
                    updated_at
            `,
            [
                newStatus,
                jobId,
            ]
        );

        await client.query(
            `
        INSERT INTO job_status_events (
            job_id,
            changed_by,
            from_status,
            to_status,
            source
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            'employer'
        )
    `,
            [
                jobId,
                employerId,
                job.status,
                newStatus,
            ]
        );

        await client.query("COMMIT");

        const updatedJob =
            updatedResult.rows[0];

        return {
            id: updatedJob.id,
            companyId: updatedJob.company_id,
            title: updatedJob.title,
            status: updatedJob.status,
            applicationDeadline:
                updatedJob.application_deadline,
            decisionDeadline:
                updatedJob.decision_deadline,
            updatedAt: updatedJob.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function cancelJob(
    employerId: string,
    jobId: string,
    input: CancelJobInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const jobResult = await client.query(
            `
                SELECT
                    j.id,
                    j.title,
                    j.status,
                    j.company_id
                FROM jobs j

                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id

                WHERE j.id = $1
                  AND cm.user_id = $2

                FOR UPDATE OF j
            `,
            [
                jobId,
                employerId,
            ]
        );

        const job = jobResult.rows[0];

        if (!job) {
            throw new Error("JOB_ACCESS_DENIED");
        }

        if (
            ![
                "open",
                "applications_closed",
                "hiring_in_progress",
            ].includes(job.status)
        ) {
            throw new Error("JOB_NOT_CANCELLABLE");
        }

        const acceptedOfferResult =
            await client.query(
                `
                    SELECT COUNT(*)::int AS count
                    FROM applications
                    WHERE job_id = $1
                      AND status = 'offer_accepted'
                `,
                [jobId]
            );

        if (
            acceptedOfferResult.rows[0].count > 0
        ) {
            throw new Error(
                "ACCEPTED_OFFER_EXISTS"
            );
        }

        const updatedJobResult =
            await client.query(
                `
                    UPDATE jobs
                    SET
                        decision_deadline_missed_at = ${missedDeadlineValue},
                        status = 'cancelled',
                        cancelled_at = NOW(),
                        cancelled_by = $1,
                        cancellation_reason = $2,
                        updated_at = NOW()
                    WHERE id = $3
                    RETURNING
                        id,
                        title,
                        status,
                        cancelled_at,
                        cancellation_reason,
                        updated_at
                `,
                [
                    employerId,
                    input.reason,
                    jobId,
                ]
            );

        const applicationsResult =
            await client.query(
                `
                    SELECT
                        id,
                        candidate_id,
                        status
                    FROM applications
                    WHERE job_id = $1
                      AND status NOT IN (
                          'offer_accepted',
                          'offer_declined',
                          'rejected',
                          'withdrawn',
                          'job_cancelled'
                      )
                    FOR UPDATE
                `,
                [jobId]
            );

        for (
            const application
            of applicationsResult.rows
        ) {
            const cancelledInterviews = await client.query(
                `UPDATE interviews SET status = 'cancelled', cancelled_at = NOW(),
                    cancelled_by = $1, updated_at = NOW()
                 WHERE application_id = $2 AND status = 'scheduled' RETURNING id`,
                [employerId, application.id]
            );
            for (const _interview of cancelledInterviews.rows) {
                await client.query(
                    `INSERT INTO notifications (user_id, type, title, message, job_id, application_id)
                     VALUES ($1, 'interview_cancelled', 'Interview cancelled', $2, $3, $4)`,
                    [application.candidate_id, `Your interview for ${job.title} was cancelled because the job was cancelled.`, jobId, application.id]
                );
            }
            await client.query(
                `
                    UPDATE applications
                    SET
                        status = 'job_cancelled',
                        updated_at = NOW()
                    WHERE id = $1
                `,
                [application.id]
            );

            await client.query(
                `
                    INSERT INTO application_events (
                        application_id,
                        changed_by,
                        from_status,
                        to_status,
                        note
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        'job_cancelled',
                        $4
                    )
                `,
                [
                    application.id,
                    employerId,
                    application.status,
                    input.reason,
                ]
            );

            await client.query(
                `
                    INSERT INTO notifications (
                        user_id,
                        type,
                        title,
                        message,
                        job_id,
                        application_id
                    )
                    VALUES (
                        $1,
                        'job_cancelled',
                        'Job cancelled',
                        $2,
                        $3,
                        $4
                    )
                `,
                [
                    application.candidate_id,
                    `The ${job.title} position has been cancelled by the employer.`,
                    jobId,
                    application.id,
                ]
            );
        }

        await client.query(
            `
        INSERT INTO job_status_events (
            job_id,
            changed_by,
            from_status,
            to_status,
            source,
            note
        )
        VALUES (
            $1,
            $2,
            $3,
            'cancelled',
            'employer',
            $4
        )
    `,
            [
                jobId,
                employerId,
                job.status,
                input.reason,
            ]
        );

        await client.query("COMMIT");

        const cancelledJob =
            updatedJobResult.rows[0];

        return {
            id: cancelledJob.id,
            title: cancelledJob.title,
            status: cancelledJob.status,
            cancellationReason:
                cancelledJob.cancellation_reason,
            cancelledAt:
                cancelledJob.cancelled_at,
            updatedAt:
                cancelledJob.updated_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function repostJob(
    employerId: string,
    jobId: string,
    input: RepostJobInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const jobResult = await client.query(
            `
                SELECT
                    j.*
                FROM jobs j

                INNER JOIN company_members cm
                    ON cm.company_id = j.company_id

                WHERE j.id = $1
                  AND cm.user_id = $2

                FOR UPDATE OF j
            `,
            [
                jobId,
                employerId,
            ]
        );

        const originalJob =
            jobResult.rows[0];

        if (!originalJob) {
            throw new Error(
                "JOB_ACCESS_DENIED"
            );
        }

        if (
            ![
                "filled",
                "cancelled",
            ].includes(originalJob.status)
        ) {
            throw new Error(
                "JOB_NOT_REPOSTABLE"
            );
        }

        const newJobResult =
            await client.query(
                `
                    INSERT INTO jobs (
                        company_id,
                        created_by,

                        title,
                        description,

                        employment_type,
                        work_mode,

                        city,
                        state,
                        country,

                        experience_min,
                        experience_max,

                        salary_min,
                        salary_max,
                        salary_currency,
                        salary_period,

                        openings,

                        application_deadline,
                        decision_deadline,

                        status,
                        parent_job_id
                    )
                    VALUES (
                        $1, $2,
                        $3, $4,
                        $5, $6,
                        $7, $8, $9,
                        $10, $11,
                        $12, $13, $14, $15,
                        $16,
                        $17, $18,
                        'draft',
                        $19
                    )
                    RETURNING *
                `,
                [
                    originalJob.company_id,
                    employerId,

                    originalJob.title,
                    originalJob.description,

                    originalJob.employment_type,
                    originalJob.work_mode,

                    originalJob.city,
                    originalJob.state,
                    originalJob.country,

                    originalJob.experience_min,
                    originalJob.experience_max,

                    originalJob.salary_min,
                    originalJob.salary_max,
                    originalJob.salary_currency,
                    originalJob.salary_period,

                    originalJob.openings,

                    input.applicationDeadline,
                    input.decisionDeadline,

                    originalJob.id,
                ]
            );

        const newJob =
            newJobResult.rows[0];

        await client.query(
            `
                INSERT INTO job_skills (
                    job_id,
                    skill_id,
                    skill_type
                )
                SELECT
                    $1,
                    skill_id,
                    skill_type
                FROM job_skills
                WHERE job_id = $2
            `,
            [
                newJob.id,
                originalJob.id,
            ]
        );

        await client.query(
            `
                INSERT INTO job_benefits (
                    job_id,
                    benefit_id
                )
                SELECT
                    $1,
                    benefit_id
                FROM job_benefits
                WHERE job_id = $2
            `,
            [
                newJob.id,
                originalJob.id,
            ]
        );

        await client.query("COMMIT");

        return {
            id: newJob.id,
            companyId:
                newJob.company_id,
            title:
                newJob.title,
            status:
                newJob.status,

            parentJobId:
                newJob.parent_job_id,

            applicationDeadline:
                newJob.application_deadline,

            decisionDeadline:
                newJob.decision_deadline,

            createdAt:
                newJob.created_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}