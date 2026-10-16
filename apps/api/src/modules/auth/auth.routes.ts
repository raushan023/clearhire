import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";

import {
    login,
    register,
    currentUser
} from "./auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/current-user", authenticate, currentUser);

export default router;