import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "./auth.middleware.js";

type UserRole = "candidate" | "employer";

export function authorizeRoles(...allowedRoles: UserRole[]) {
    return (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "You do not have permission to access this resource",
            });
        }

        next();
    };
}