import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";
import { createCompanyController } from "./company.controller.js";

const router = Router();

router.post(
    "/",
    authenticate,
    authorizeRoles("employer"),
    createCompanyController
);

export default router;