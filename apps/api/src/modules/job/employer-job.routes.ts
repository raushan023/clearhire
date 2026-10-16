import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";
import { getEmployerJobsController, updateJobStatusController, cancelJobController, repostJobController } from "./job.controller.js";
import {
    getEmployerJobApplicationsController,
    updateApplicationStatusController,
    getEmployerFeedbackObligationsController,
    scheduleInterviewController,
    rescheduleInterviewController,
    cancelInterviewController
} from "../application/application.controller.js";

const router = Router();

router.get(
    "/jobs",
    authenticate,
    authorizeRoles("employer"),
    getEmployerJobsController
);

router.get(
    "/jobs/:jobId/applications",
    authenticate,
    authorizeRoles("employer"),
    getEmployerJobApplicationsController
);

router.patch(
    "/applications/:applicationId/status",
    authenticate,
    authorizeRoles("employer"),
    updateApplicationStatusController
);

router.patch(
    "/jobs/:jobId/status",
    authenticate,
    authorizeRoles("employer"),
    updateJobStatusController
);

router.get(
    "/feedback-obligations",
    authenticate,
    authorizeRoles("employer"),
    getEmployerFeedbackObligationsController
);

router.post(
    "/applications/:applicationId/interviews",
    authenticate,
    authorizeRoles("employer"),
    scheduleInterviewController
);

router.patch(
    "/interviews/:interviewId",
    authenticate,
    authorizeRoles("employer"),
    rescheduleInterviewController
);

router.patch(
    "/interviews/:interviewId/cancel",
    authenticate,
    authorizeRoles("employer"),
    cancelInterviewController
);

router.patch(
    "/jobs/:jobId/cancel",
    authenticate,
    authorizeRoles("employer"),
    cancelJobController
);

router.post(
    "/jobs/:jobId/repost",
    authenticate,
    authorizeRoles("employer"),
    repostJobController
);

export default router;