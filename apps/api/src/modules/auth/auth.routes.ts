import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";

import {
    login,
    register,
    currentUser,
    updateAccount
} from "./auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/current-user", authenticate, currentUser);
router.patch("/current-user", authenticate, updateAccount);

export default router;