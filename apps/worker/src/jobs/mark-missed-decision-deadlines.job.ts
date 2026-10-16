import { pool } from "../config/database.js";

export async function markMissedDecisionDeadlines() {
    const result = await pool.query(
        `
            UPDATE jobs
            SET
                decision_deadline_missed_at = decision_deadline,
                updated_at = NOW()

            WHERE decision_deadline < statement_timestamp()
              AND decision_deadline_missed_at IS NULL

              AND status IN ('open', 'applications_closed', 'hiring_in_progress')
              AND EXISTS (
                  SELECT 1 FROM applications a WHERE a.job_id = jobs.id
                  AND a.status IN ('applied', 'under_review', 'shortlisted', 'interview', 'final_review', 'offer')
              )

            RETURNING
                id,
                title,
                decision_deadline,
                decision_deadline_missed_at
        `
    );

    return {
        missedCount: result.rowCount ?? 0,
        jobs: result.rows,
    };
}
