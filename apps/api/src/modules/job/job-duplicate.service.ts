import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

// Exact normalized content only: deliberately avoid fuzzy thresholds that could
// reject distinct roles. Dates/opening counts do not make a duplicate role new.
export function hashJobContent(job: Record<string, any>): string {
    const text = (v: unknown) => String(v ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
    const ids = (v: string[] | undefined) => [...(v ?? [])].map(id => id.toLowerCase()).sort();
    const value = {
        title: text(job.title), description: text(job.description),
        employmentType: job.employment_type, workMode: job.work_mode,
        city: text(job.city), state: text(job.state), country: text(job.country),
        experienceMin: Number(job.experience_min), experienceMax: Number(job.experience_max),
        salaryMin: String(job.salary_min), salaryMax: String(job.salary_max),
        salaryCurrency: text(job.salary_currency), salaryPeriod: job.salary_period,
        required: ids(job.required_ids), preferred: ids(job.preferred_ids), benefits: ids(job.benefit_ids),
    };
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function protectActiveJobContent(client: PoolClient, jobId: string) {
    // Every publisher/editor holds its own job lock first, then this company
    // lock. Competing publishes are serialized without locking other jobs.
    await client.query(`SELECT id FROM companies
        WHERE id = (SELECT company_id FROM jobs WHERE id = $1) FOR UPDATE`, [jobId]);
    const result = await client.query(`SELECT j.*,
        ARRAY(SELECT skill_id::text FROM job_skills WHERE job_id = j.id AND skill_type = 'required') AS required_ids,
        ARRAY(SELECT skill_id::text FROM job_skills WHERE job_id = j.id AND skill_type = 'preferred') AS preferred_ids,
        ARRAY(SELECT benefit_id::text FROM job_benefits WHERE job_id = j.id) AS benefit_ids
        FROM jobs j WHERE company_id = (SELECT company_id FROM jobs WHERE id = $1)
        AND (id = $1 OR status IN ('open', 'applications_closed', 'hiring_in_progress'))`, [jobId]);
    const own = result.rows.find(j => j.id === jobId);
    if (!own) throw new Error("JOB_NOT_FOUND");
    const hash = hashJobContent(own);
    if (result.rows.some(j => j.id !== jobId && hashJobContent(j) === hash)) throw new Error("DUPLICATE_ACTIVE_JOB");
    await client.query("UPDATE jobs SET content_hash = $2 WHERE id = $1", [jobId, hash]);
}
