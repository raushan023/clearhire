import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { candidateProfileSchema } from "./candidate.schema.js";
import { getCandidateProfile, updateCandidateProfile, saveJob, unsaveJob, listSavedJobs } from "./candidate.service.js";
import { jobIdParamSchema } from "../job/job.schema.js";
import { paginationSchema } from "../../utils/pagination.js";
import { respondToClientError } from "../../utils/client-error.js";

export async function getProfileController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    try {
        return res.json({ profile: await getCandidateProfile(req.user.id) });
    } catch (error) { return profileError(error, res); }
}
export async function updateProfileController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const input = candidateProfileSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Invalid profile", errors: input.error.flatten().fieldErrors });
    try {
        return res.json({ profile: await updateCandidateProfile(req.user.id, input.data) });
    } catch (error) { return profileError(error, res); }
}
function profileError(error: unknown, res: Response) {
    if (respondToClientError(error, res)) return;
    console.error("Candidate profile request failed");
    return res.status(500).json({ message: "Internal server error" });
}
export async function listSavedJobsController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const query = paginationSchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Invalid pagination" });
    try {
        return res.json(await listSavedJobs(req.user.id, query.data));
    } catch (error) {
        console.error("Saved jobs request failed");
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function saveJobController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const params = jobIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ message: "Invalid job ID" });
    try {
        await saveJob(req.user.id, params.data.jobId);
        return res.status(204).send();
    } catch (error) {
        if (error instanceof Error && error.message === "JOB_NOT_ACCESSIBLE") return res.status(404).json({ message: "Job not available to save" });
        if (error instanceof Error && error.message === "JOB_NOT_OPEN") return res.status(409).json({ message: "Job is not open for saving" });
        console.error("Saved jobs request failed");
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function unsaveJobController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const params = jobIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ message: "Invalid job ID" });
    try {
        await unsaveJob(req.user.id, params.data.jobId);
        return res.status(204).send();
    } catch (error) {
        console.error("Saved jobs request failed");
        return res.status(500).json({ message: "Internal server error" });
    }
}
