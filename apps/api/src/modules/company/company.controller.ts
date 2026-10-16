import type { Response } from "express";

import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { createCompanySchema } from "./company.schema.js";
import { createCompany } from "./company.service.js";

export async function createCompanyController(
    req: AuthenticatedRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }

    const validationResult = createCompanySchema.safeParse(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            message: "Invalid company data",
            errors: validationResult.error.flatten().fieldErrors,
        });
    }

    try {
        const company = await createCompany(
            req.user.id,
            validationResult.data
        );

        return res.status(201).json({
            message: "Company created successfully",
            company,
        });
    } catch (error) {
        console.error("Company creation failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}