import { getResumeController, replaceResumeController, deleteResumeController, downloadResumeController } from "../resume/resume.controller.js";
import { Router, raw } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";
import { getProfileController, updateProfileController, listSavedJobsController, saveJobController, unsaveJobController } from "./candidate.controller.js";

const router = Router();
router.use(authenticate, authorizeRoles("candidate"));
router.get("/profile", getProfileController);
router.patch("/profile", updateProfileController);
router.get("/saved-jobs", listSavedJobsController);
router.put("/saved-jobs/:jobId", saveJobController);
router.delete("/saved-jobs/:jobId", unsaveJobController);
router.get("/resume", getResumeController);
router.put("/resume", raw({ type: 'application/pdf', limit: '5mb' }), replaceResumeController);
router.delete("/resume", deleteResumeController);
router.get("/resume/download", downloadResumeController);
export default router;
