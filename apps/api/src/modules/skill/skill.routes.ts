import { Router } from "express";

import { getSkills } from "./skill.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, getSkills);

export default router;