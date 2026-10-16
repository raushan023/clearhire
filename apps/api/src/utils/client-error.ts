import type { Response } from "express";

// Deliberately map only known user-controlled constraints; unexpected database
// failures must still be logged and returned as server errors.
export function respondToClientError(error: unknown, res: Response): boolean {
    const issue = error as { code?: string; constraint?: string; message?: string } | null;
    if (!issue) return false;
    if (issue.message === 'CANDIDATE_NOT_FOUND') {
        res.status(404).json({ message: 'Candidate not found' });
        return true;
    }
    const foreignKeys = new Set([
        "job_skills_skill_id_fkey", "job_benefits_benefit_id_fkey",
        "candidate_profile_skills_skill_id_fkey",
    ]);
    if (issue.code === "23503" && foreignKeys.has(issue.constraint ?? "")) {
        res.status(400).json({ message: "One or more skill or benefit IDs do not exist" });
        return true;
    }
    if (issue.code === "23505" && ["job_skills_pkey", "job_benefits_pkey", "candidate_profile_skills_pkey"].includes(issue.constraint ?? "")) {
        res.status(400).json({ message: "Skills and benefits must be unique and skill types must not overlap" });
        return true;
    }
    if (issue.message === "DUPLICATE_ACTIVE_JOB" ||
        (issue.code === "23505" && issue.constraint === "idx_jobs_active_company_content_unique")) {
        res.status(409).json({ message: "This company already has an active posting with the same content" });
        return true;
    }
    return false;
}
