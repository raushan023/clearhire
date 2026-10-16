import { Router } from "express";

import { listBenefits } from "./benefit.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, listBenefits);

export default router;