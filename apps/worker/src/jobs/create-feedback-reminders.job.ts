import { pool } from "../config/database.js";

export async function createFeedbackReminders() {
    const result = await pool.query(
        `
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                job_id
            )

            SELECT
                cm.user_id,
                'feedback_overdue',
                'Candidate feedback overdue',
                CONCAT(
                    COUNT(a.id),
                    ' candidate(s) are still waiting for an outcome for ',
                    j.title,
                    '.'
                ),
                j.id

            FROM jobs j

            INNER JOIN applications a
                ON a.job_id = j.id

            INNER JOIN company_members cm
                ON cm.company_id = j.company_id

            WHERE
                j.decision_deadline_missed_at IS NOT NULL

                AND a.status IN (
                    'applied',
                    'under_review',
                    'shortlisted',
                    'interview',
                    'final_review'
                )

            GROUP BY
                cm.user_id,
                j.id,
                j.title

            ON CONFLICT (
                user_id,
                job_id,
                type
            )
            WHERE type = 'feedback_overdue'

            DO NOTHING

            RETURNING
                id,
                user_id,
                job_id,
                type
        `
    );

    return {
        createdCount: result.rowCount ?? 0,
        notifications: result.rows,
    };
}