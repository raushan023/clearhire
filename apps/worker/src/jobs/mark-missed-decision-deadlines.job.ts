import { pool } from "../config/database.js";

export async function markMissedDecisionDeadlines() {
    const result = await pool.query(
        `
            UPDATE jobs
            SET
                decision_deadline_missed_at = NOW(),
                updated_at = NOW()

            WHERE decision_deadline < NOW()
              AND decision_deadline_missed_at IS NULL

              AND status NOT IN (
                  'filled',
                  'cancelled',
                  'expired'
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