import { Router } from "express";

import {
    authenticate,
} from "../../middleware/auth.middleware.js";

import {
    getNotificationsController,
    markNotificationAsReadController,
    getUnreadNotificationCountController
} from "./notification.controller.js";

const router = Router();

router.get(
    "/",
    authenticate,
    getNotificationsController
);

router.get(
    "/unread-count",
    authenticate,
    getUnreadNotificationCountController
);

router.patch(
    "/:notificationId/read",
    authenticate,
    markNotificationAsReadController
);

export default router;