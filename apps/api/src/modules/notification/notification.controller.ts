import type { Response } from "express";

import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import {
    getUserNotifications,
    markNotificationAsRead,
    getUnreadNotificationCount
} from "./notification.service.js";

import {
    notificationIdParamSchema, notificationSearchSchema,
} from "./notification.schema.js";

export async function getNotificationsController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const query = notificationSearchSchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Invalid pagination", errors: query.error.flatten().fieldErrors });
    try {
        const result =
            await getUserNotifications(req.user.id, query.data);

        return res.status(200).json(result);
    } catch (error) {
        console.error(
            "Fetching notifications failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function markNotificationAsReadController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const paramsResult =
        notificationIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({
            message: "Invalid notification ID",
        });
    }

    try {
        const notification =
            await markNotificationAsRead(
                req.user.id,
                paramsResult.data.notificationId
            );

        return res.status(200).json({
            message: "Notification marked as read",
            notification,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "NOTIFICATION_NOT_FOUND"
        ) {
            return res.status(404).json({
                message: "Notification not found",
            });
        }

        console.error(
            "Marking notification as read failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function getUnreadNotificationCountController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    try {
        const count =
            await getUnreadNotificationCount(
                req.user.id
            );

        return res.status(200).json({
            count,
        });
    } catch (error) {
        console.error(
            "Fetching unread notification count failed:",
            error
        );

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}