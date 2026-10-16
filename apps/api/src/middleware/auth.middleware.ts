import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type AuthTokenPayload = {
    sub: string;
    role: "candidate" | "employer";
};

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: "candidate" | "employer";
    };
}

export function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            message: "Invalid authorization header",
        });
    }

    const jwtSecret = process.env.JWT_ACCESS_SECRET;

    if (!jwtSecret) {
        throw new Error("JWT_ACCESS_SECRET is not defined");
    }

    try {
        const payload = jwt.verify(
            token,
            jwtSecret,
            { algorithms: ["HS256"] }
        ) as AuthTokenPayload;

        if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) ||
            !['candidate', 'employer'].includes(payload.role)) {
            return res.status(401).json({
                message: "Invalid access token",
            });
        }

        req.user = {
            id: payload.sub,
            role: payload.role,
        };

        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired access token",
        });
    }
}