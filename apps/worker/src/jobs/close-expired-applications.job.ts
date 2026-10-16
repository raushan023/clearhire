import { pool } from "../config/database.js";

export async function closeExpiredApplications() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            UPDATE jobs
            SET
                status = 'applications_closed',
                applications_closed_at = NOW(),
                applications_closed_by = 'system',
                updated_at = NOW()
            WHERE status = 'open'
              AND application_deadline <= NOW()
            RETURNING
                id,
                title
        `
        );

        for (const job of result.rows) {
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
                    NULL,
                    'open',
                    'applications_closed',
                    'system'
                )
            `,
                [job.id]
            );
        }

        await client.query("COMMIT");

        return {
            closedCount: result.rowCount ?? 0,
            jobs: result.rows,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}