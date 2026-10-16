import type { Pool, PoolClient } from "pg";
import { canReadCurrentCandidateData } from "../application/application-privacy.js";
import { randomUUID } from "node:crypto";
import { pool } from "../../config/database.js";
import { resumeStorage, type ResumeStorage } from "./resume.storage.js";
import { resumeFilenameSchema, validateResume } from "./resume.schema.js";

export async function getResumeMetadata(candidateId: string, db: Pool | PoolClient = pool) {
    const result = await db.query(`SELECT id, filename, media_type, size_bytes, created_at, updated_at
        FROM candidate_resumes WHERE candidate_id = $1`, [candidateId]);
    const r = result.rows[0];
    return r ? { id: r.id, filename: r.filename, mediaType: r.media_type, sizeBytes: r.size_bytes,
        createdAt: r.created_at, updatedAt: r.updated_at } : null;
}
export async function replaceResume(candidateId: string, filename: string, content: Buffer, mediaType: string, storage: ResumeStorage = resumeStorage) {
    filename = resumeFilenameSchema.parse(filename);
    validateResume(content, mediaType);
    if (!storage.configured) throw new Error("RESUME_STORAGE_UNAVAILABLE");
    const key = `resumes/${randomUUID()}.pdf`;
    const client = await pool.connect();
    let oldKey: string | undefined;
    let commitAttempted = false;
    let uploaded = false;
    try {
        await client.query("BEGIN");
        const owner = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'candidate' FOR UPDATE", [candidateId]);
        if (!owner.rowCount) throw new Error("CANDIDATE_NOT_FOUND");
        const previous = await client.query("SELECT storage_key FROM candidate_resumes WHERE candidate_id = $1", [candidateId]);
        oldKey = previous.rows[0]?.storage_key;
        await storage.put(key, content);
        uploaded = true;
        await client.query(`INSERT INTO candidate_resumes(candidate_id, storage_key, filename, media_type, size_bytes)
            VALUES ($1, $2, $3, 'application/pdf', $4)
            ON CONFLICT (candidate_id) DO UPDATE SET id = gen_random_uuid(), storage_key = EXCLUDED.storage_key,
            filename = EXCLUDED.filename, media_type = EXCLUDED.media_type, size_bytes = EXCLUDED.size_bytes, updated_at = NOW()`,
            [candidateId, key, filename, content.length]);
        commitAttempted = true;
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        if (uploaded && !commitAttempted) await storage.delete(key).catch(() => console.error("Resume upload cleanup failed"));
        throw error;
    } finally { client.release(); }
    if (oldKey) await storage.delete(oldKey).catch(() => console.error("Replaced resume cleanup failed"));
    return getResumeMetadata(candidateId);
}
async function readResume(client: PoolClient, candidateId: string, storage: ResumeStorage) {
    if (!storage.configured) throw new Error("RESUME_STORAGE_UNAVAILABLE");
    await client.query("SELECT id FROM users WHERE id = $1 FOR SHARE", [candidateId]);
    const result = await client.query("SELECT storage_key, filename FROM candidate_resumes WHERE candidate_id = $1", [candidateId]);
    const row = result.rows[0];
    if (!row) throw new Error("RESUME_NOT_FOUND");
    return { filename: row.filename as string, content: await storage.get(row.storage_key) };
}
export async function readOwnResume(candidateId: string, storage: ResumeStorage = resumeStorage) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await readResume(client, candidateId, storage);
        await client.query("COMMIT");
        return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
}
export async function readApplicationResume(employerId: string, applicationId: string, storage: ResumeStorage = resumeStorage) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`SELECT a.candidate_id, a.status FROM applications a JOIN jobs j ON j.id = a.job_id
            JOIN company_members cm ON cm.company_id = j.company_id WHERE a.id = $1 AND cm.user_id = $2
            FOR SHARE OF a, cm`, [applicationId, employerId]);
        if (!result.rowCount) throw new Error("APPLICATION_ACCESS_DENIED");
        if (!canReadCurrentCandidateData(result.rows[0].status)) throw new Error('RESUME_NOT_FOUND');
        const resume = await readResume(client, result.rows[0].candidate_id, storage);
        await client.query('COMMIT');
        return resume;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
export async function deleteResume(candidateId: string, storage: ResumeStorage = resumeStorage) {
    if (!storage.configured) throw new Error("RESUME_STORAGE_UNAVAILABLE");
    const client = await pool.connect();
    let key: string | undefined;
    try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [candidateId]);
        const result = await client.query("DELETE FROM candidate_resumes WHERE candidate_id = $1 RETURNING storage_key", [candidateId]);
        key = result.rows[0]?.storage_key;
        await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    if (key) await storage.delete(key).catch(() => console.error("Deleted resume cleanup failed"));
}
