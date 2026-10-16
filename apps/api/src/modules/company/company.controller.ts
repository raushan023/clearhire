import type { Response } from "express";

import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { companyIdSchema, updateCompanySchema, addRecruiterSchema, createCompanySchema } from "./company.schema.js";
import { listCompanies, getCompany, updateCompany, listCompanyMembers, addRecruiter, createCompany } from "./company.service.js";

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

export async function listCompaniesController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    try { return res.json({ companies: await listCompanies(req.user.id) }); }
    catch (error) { return companyError(error, res); }
}
export async function getCompanyController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const params = companyIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ message: "Invalid company ID" });
    try { return res.json({ company: await getCompany(req.user.id, params.data.companyId) }); }
    catch (error) { return companyError(error, res); }
}
export async function updateCompanyController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const params = companyIdSchema.safeParse(req.params);
    const input = updateCompanySchema.safeParse(req.body);
    if (!params.success) return res.status(400).json({ message: "Invalid company ID" });
    if (!input.success) return res.status(400).json({ message: "Invalid company data", errors: input.error.flatten().fieldErrors });
    try { return res.json({ company: await updateCompany(req.user.id, params.data.companyId, input.data) }); }
    catch (error) { return companyError(error, res); }
}
export async function listCompanyMembersController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const params = companyIdSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ message: "Invalid company ID" });
    try { return res.json({ members: await listCompanyMembers(req.user.id, params.data.companyId) }); }
    catch (error) { return companyError(error, res); }
}
export async function addRecruiterController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const params = companyIdSchema.safeParse(req.params);
    const input = addRecruiterSchema.safeParse(req.body);
    if (!params.success) return res.status(400).json({ message: "Invalid company ID" });
    if (!input.success) return res.status(400).json({ message: "Invalid company data", errors: input.error.flatten().fieldErrors });
    try { return res.status(201).json({ member: await addRecruiter(req.user.id, params.data.companyId, input.data.userId) }); }
    catch (error) { return companyError(error, res); }
}
function companyError(error: unknown, res: Response) {
    if (error instanceof Error) {
        if (["COMPANY_ACCESS_DENIED", "COMPANY_OWNER_REQUIRED"].includes(error.message)) return res.status(403).json({ message: "Company access denied or owner role required" });
        if (error.message === "EMPLOYER_NOT_FOUND") return res.status(404).json({ message: "Existing employer not found" });
        if (error.message === "ALREADY_COMPANY_MEMBER") return res.status(409).json({ message: "User is already a company member" });
    }
    console.error("Company management request failed");
    return res.status(500).json({ message: "Internal server error" });
}
