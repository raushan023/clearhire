import { Router } from "express";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";
import { listCompaniesController, getCompanyController, updateCompanyController, listCompanyMembersController, addRecruiterController, createCompanyController } from "./company.controller.js";

const router = Router();

router.post(
    "/",
    authenticate,
    authorizeRoles("employer"),
    createCompanyController
);

router.use(authenticate, authorizeRoles("employer"));
router.get("/", listCompaniesController);
router.get("/:companyId", getCompanyController);
router.patch("/:companyId", updateCompanyController);
router.get("/:companyId/members", listCompanyMembersController);
router.post("/:companyId/members", addRecruiterController);

export default router;