import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import {
    loginSchema,
    registerSchema,
    updateCurrentUserSchema,
} from "./auth.schema.js";

import {
    loginUser,
    registerUser,
    getCurrentUser,
    updateCurrentUser
} from "./auth.service.js";

export async function register(
    req: Request,
    res: Response
) {
    const validationResult = registerSchema.safeParse(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid registration data",
            errors: validationResult.error.flatten().fieldErrors,
        });
    }

    try {
        const user = await registerUser(validationResult.data);

        return res.status(201).json({
            message: "Account created successfully",
            user,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "EMAIL_ALREADY_EXISTS"
        ) {
            return res.status(409).json({
                message: "An account with this email already exists",
            });
        }

        console.error("Registration failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function login(
    req: Request,
    res: Response
) {
    const validationResult = loginSchema.safeParse(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid login data",
            errors: validationResult.error.flatten().fieldErrors,
        });
    }
    try {
        const result = await loginUser(validationResult.data);

        return res.status(200).json({
            message: "Login successful",
            ...result,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "INVALID_CREDENTIALS"
        ) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        console.error("Login failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function currentUser(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    try {
        const user = await getCurrentUser(req.user.id);

        return res.status(200).json({
            user,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "USER_NOT_FOUND"
        ) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        console.error("Get current user failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}

export async function updateAccount(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const result = updateCurrentUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({
        message: "Provide valid account fields: firstName, lastName, email, or phone",
        errors: result.error.flatten().fieldErrors,
    });
    try {
        const user = await updateCurrentUser(req.user.id, result.data);
        return res.status(200).json({ user });
    } catch (error) {
        if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
            return res.status(409).json({ message: "An account with this email already exists",
                code: "EMAIL_ALREADY_EXISTS", errors: { email: ["An account with this email already exists"] } });
        }
        if (error instanceof Error && error.message === "USER_NOT_FOUND") {
            return res.status(404).json({ message: "User not found" });
        }
        console.error("Update current user failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
