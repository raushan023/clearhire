import { pool } from "../../config/database.js";

export async function getUserNotifications(
    userId: string
) {
    const result = await pool.query(
        `
            SELECT
                id,
                type,
                title,
                message,
                job_id,
                application_id,
                read_at,
                created_at
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `,
        [userId]
    );

    return result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        jobId: row.job_id,
        applicationId: row.application_id,
        readAt: row.read_at,
        createdAt: row.created_at,
    }));
}

export async function markNotificationAsRead(
    userId: string,
    notificationId: string
) {
    const result = await pool.query(
        `
            UPDATE notifications
            SET read_at = COALESCE(read_at, NOW())
            WHERE id = $1
              AND user_id = $2
            RETURNING
                id,
                type,
                title,
                message,
                job_id,
                application_id,
                read_at,
                created_at
        `,
        [
            notificationId,
            userId,
        ]
    );

    const notification = result.rows[0];

    if (!notification) {
        throw new Error("NOTIFICATION_NOT_FOUND");
    }

    return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        jobId: notification.job_id,
        applicationId: notification.application_id,
        readAt: notification.read_at,
        createdAt: notification.created_at,
    };
}

export async function getUnreadNotificationCount(
    userId: string
) {
    const result = await pool.query(
        `
            SELECT COUNT(*)::int AS count
            FROM notifications
            WHERE user_id = $1
              AND read_at IS NULL
        `,
        [userId]
    );

    return result.rows[0].count;
}