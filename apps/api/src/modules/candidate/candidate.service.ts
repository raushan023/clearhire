import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { CandidateProfileInput } from "./candidate.schema.js";
import type { PaginationInput } from "../../utils/pagination.js";
import { pagination } from "../../utils/pagination.js";

export async function getCandidateProfile(candidateId: string, db: Pool | PoolClient = pool) {
    const result = await db.query(`SELECT p.*,
        COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
            FROM candidate_profile_skills ps JOIN skills s ON s.id = ps.skill_id
            WHERE ps.candidate_id = p.candidate_id), '[]'::json) AS skills
        FROM candidate_profiles p WHERE p.candidate_id = $1`, [candidateId]);
    const p = result.rows[0];
    return p ? { headline: p.headline, summary: p.summary, totalExperience: p.total_experience === null ? null : Number(p.total_experience),
        city: p.city, state: p.state, country: p.country, currentCompany: p.current_company,
        currentTitle: p.current_title, skills: p.skills, createdAt: p.created_at, updatedAt: p.updated_at } : null;
}

export async function updateCandidateProfile(candidateId: string, input: CandidateProfileInput) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const owner = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'candidate' FOR UPDATE", [candidateId]);
        if (!owner.rowCount) throw new Error("CANDIDATE_NOT_FOUND");
        await client.query("INSERT INTO candidate_profiles(candidate_id) VALUES ($1) ON CONFLICT DO NOTHING", [candidateId]);
        const fields: Record<string, string> = { headline: 'headline', summary: 'summary', totalExperience: 'total_experience',
            city: 'city', state: 'state', country: 'country', currentCompany: 'current_company', currentTitle: 'current_title' };
        const values: unknown[] = [candidateId];
        const assignments: string[] = [];
        for (const [key, column] of Object.entries(fields)) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                values.push(input[key as keyof CandidateProfileInput]);
                assignments.push(`${column} = $${values.length}`);
            }
        }
        assignments.push("updated_at = NOW()");
        await client.query(`UPDATE candidate_profiles SET ${assignments.join(', ')} WHERE candidate_id = $1`, values);
        if (input.skillIds !== undefined) {
            await client.query("DELETE FROM candidate_profile_skills WHERE candidate_id = $1", [candidateId]);
            for (const id of input.skillIds) await client.query(
                "INSERT INTO candidate_profile_skills(candidate_id, skill_id) VALUES ($1, $2)", [candidateId, id]);
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
    return getCandidateProfile(candidateId);
}

export async function saveJob(candidateId: string, jobId: string) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const job = await client.query('SELECT status FROM jobs WHERE id = $1 FOR SHARE', [jobId]);
        if (!job.rowCount || job.rows[0].status === 'draft') throw new Error('JOB_NOT_ACCESSIBLE');
        const existing = await client.query('SELECT 1 FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2', [candidateId, jobId]);
        if (!existing.rowCount) {
            if (job.rows[0].status !== 'open') throw new Error('JOB_NOT_OPEN');
            await client.query('INSERT INTO saved_jobs(candidate_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [candidateId, jobId]);
        }
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
export async function unsaveJob(candidateId: string, jobId: string) {
    await pool.query("DELETE FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2", [candidateId, jobId]);
}
export async function listSavedJobs(candidateId: string, input: PaginationInput) {
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM saved_jobs WHERE candidate_id = $1", [candidateId]);
    const result = await pool.query(`SELECT j.id, j.title, j.status, j.application_deadline, j.decision_deadline,
        c.id AS company_id, c.name AS company_name, sj.created_at AS saved_at
        FROM saved_jobs sj JOIN jobs j ON j.id = sj.job_id JOIN companies c ON c.id = j.company_id
        WHERE sj.candidate_id = $1 ORDER BY sj.created_at DESC, j.id DESC LIMIT $2 OFFSET $3`,
        [candidateId, input.limit, (input.page - 1) * input.limit]);
    return { jobs: result.rows.map(j => ({ id: j.id, title: j.title, status: j.status,
        applicationDeadline: j.application_deadline, decisionDeadline: j.decision_deadline, savedAt: j.saved_at,
        company: { id: j.company_id, name: j.company_name } })), pagination: pagination(input.page, input.limit, count.rows[0].total) };
}
