import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";

import { createJobController, publishJobController, updateJobController, getJobController, searchJobsController } from "./job.controller.js";

const router = Router();

router.post(
    "/",
    authenticate,
    authorizeRoles("employer"),
    createJobController
);

router.patch(
    "/:jobId/publish",
    authenticate,
    authorizeRoles("employer"),
    publishJobController
);

router.patch(
    "/:jobId",
    authenticate,
    authorizeRoles("employer"),
    updateJobController
);

router.get(
    "/",
    authenticate,
    authorizeRoles("candidate"),
    searchJobsController
);

router.get(
    "/:jobId",
    authenticate,
    getJobController
);

export default router;