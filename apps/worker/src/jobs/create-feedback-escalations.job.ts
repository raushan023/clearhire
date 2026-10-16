import { pool } from "../config/database.js";

export async function createFeedbackEscalations() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const twentyFourHourResult =
            await client.query(
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
                        'feedback_overdue_24h',
                        'Candidate feedback overdue for 24 hours',

                        CONCAT(
                            COUNT(a.id),
                            ' candidate(s) are still waiting for an outcome for ',
                            j.title,
                            '. Please update their application status.'
                        ),

                        j.id

                    FROM jobs j

                    INNER JOIN applications a
                        ON a.job_id = j.id

                    INNER JOIN company_members cm
                        ON cm.company_id = j.company_id

                    WHERE
                        j.decision_deadline_missed_at
                            IS NOT NULL

                        AND
                        j.decision_deadline_missed_at
                            <= NOW() - INTERVAL '24 hours'

                        AND a.status IN (
                            'applied',
                            'under_review',
                            'shortlisted',
                            'interview',
                            'final_review',
                            'offer'
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
                    WHERE type IN (
                        'feedback_overdue',
                        'feedback_overdue_24h',
                        'feedback_overdue_72h'
                    )
                    DO NOTHING

                    RETURNING
                        id,
                        user_id,
                        job_id,
                        type
                `
            );

        const seventyTwoHourResult =
            await client.query(
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
                        'feedback_overdue_72h',
                        'Final feedback compliance warning',

                        CONCAT(
                            COUNT(a.id),
                            ' candidate(s) are still waiting for an outcome for ',
                            j.title,
                            '. Continued failure to provide feedback may result in account restrictions.'
                        ),

                        j.id

                    FROM jobs j

                    INNER JOIN applications a
                        ON a.job_id = j.id

                    INNER JOIN company_members cm
                        ON cm.company_id = j.company_id

                    WHERE
                        j.decision_deadline_missed_at
                            IS NOT NULL

                        AND
                        j.decision_deadline_missed_at
                            <= NOW() - INTERVAL '72 hours'

                        AND a.status IN (
                            'applied',
                            'under_review',
                            'shortlisted',
                            'interview',
                            'final_review',
                            'offer'
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
                    WHERE type IN (
                        'feedback_overdue',
                        'feedback_overdue_24h',
                        'feedback_overdue_72h'
                    )
                    DO NOTHING

                    RETURNING
                        id,
                        user_id,
                        job_id,
                        type
                `
            );

        await client.query("COMMIT");

        return {
            twentyFourHourCreated:
                twentyFourHourResult.rowCount ?? 0,

            seventyTwoHourCreated:
                seventyTwoHourResult.rowCount ?? 0,

            notifications: [
                ...twentyFourHourResult.rows,
                ...seventyTwoHourResult.rows,
            ],
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}