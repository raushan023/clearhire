import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";

import {
    applyToJobController,
    getMyApplicationController,
    getMyApplicationsController,
    withdrawApplicationController,
    respondToOfferController
} from "./application.controller.js";

const router = Router();

router.post(
    "/jobs/:jobId/apply",
    authenticate,
    authorizeRoles("candidate"),
    applyToJobController
);

router.get(
    "/applications/me",
    authenticate,
    authorizeRoles("candidate"),
    getMyApplicationsController
);

router.get(
    "/applications/:applicationId",
    authenticate,
    authorizeRoles("candidate"),
    getMyApplicationController
);

router.patch(
    "/applications/:applicationId/withdraw",
    authenticate,
    authorizeRoles("candidate"),
    withdrawApplicationController
);

router.patch(
    "/applications/:applicationId/offer-response",
    authenticate,
    authorizeRoles("candidate"),
    respondToOfferController
);

export default router;