import { z } from "zod";
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const resumeFilenameSchema = z.string().trim().min(1).max(150)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]*\.pdf$/i, "Use a simple PDF filename without paths");
export function validateResume(content: unknown, mediaType: string | undefined): asserts content is Buffer {
    if (!Buffer.isBuffer(content) || content.length === 0 || content.length > MAX_RESUME_BYTES) throw new Error("INVALID_RESUME_SIZE");
    if (mediaType?.split(';')[0]?.trim().toLowerCase() !== 'application/pdf' ||
        content.subarray(0, 5).toString('ascii') !== '%PDF-' || !content.subarray(-1024).includes(Buffer.from('%%EOF'))) {
        throw new Error("INVALID_RESUME_TYPE");
    }
}
