import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { applicationIdParamSchema } from "../application/application.schema.js";
import { resumeFilenameSchema } from "./resume.schema.js";
import { getResumeMetadata, replaceResume, readOwnResume, readApplicationResume, deleteResume } from "./resume.service.js";

export async function getResumeController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    res.set('Cache-Control', 'no-store');
    try { return res.json({ resume: await getResumeMetadata(req.user.id) }); }
    catch (error) { return resumeError(error, res); }
}
export async function replaceResumeController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const filename = resumeFilenameSchema.safeParse(req.get('X-File-Name') ?? 'resume.pdf');
    if (!filename.success) return res.status(400).json({ message: "Invalid filename" });
    res.set('Cache-Control', 'no-store');
    try { return res.json({ resume: await replaceResume(req.user.id, filename.data, req.body, req.get('Content-Type') ?? '') }); }
    catch (error) { return resumeError(error, res); }
}
export async function deleteResumeController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    res.set('Cache-Control', 'no-store');
    try { await deleteResume(req.user.id); return res.status(204).send(); }
    catch (error) { return resumeError(error, res); }
}
export async function downloadResumeController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    res.set('Cache-Control', 'no-store');
    try { return sendResume(res, await readOwnResume(req.user.id)); }
    catch (error) { return resumeError(error, res); }
}
export async function downloadApplicationResumeController(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const application = applicationIdParamSchema.safeParse(req.params);
    if (!application.success) return res.status(400).json({ message: "Invalid application ID" });
    res.set('Cache-Control', 'no-store');
    try { return sendResume(res, await readApplicationResume(req.user.id, application.data.applicationId)); }
    catch (error) { return resumeError(error, res); }
}
function sendResume(res: Response, result: { filename: string; content: Buffer }) {
    return res.set({ 'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename.replace(/[^A-Za-z0-9 ._-]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff' }).send(result.content);
}
function resumeError(error: unknown, res: Response) {
    if (error instanceof Error) {
        if (error.message === 'RESUME_STORAGE_UNAVAILABLE') return res.status(503).json({ message: "Resume storage is not configured" });
        if (error.message === 'CANDIDATE_NOT_FOUND') return res.status(404).json({ message: 'Candidate not found' });
        if (error.message === 'RESUME_NOT_FOUND') return res.status(404).json({ message: "Resume not found" });
        if (error.message === 'APPLICATION_ACCESS_DENIED') return res.status(403).json({ message: "Application access denied" });
        if (['INVALID_RESUME_SIZE', 'INVALID_RESUME_TYPE'].includes(error.message)) return res.status(400).json({ message: "Upload a valid PDF no larger than 5 MiB" });
    }
    console.error("Resume request failed");
    return res.status(500).json({ message: "Internal server error" });
}
