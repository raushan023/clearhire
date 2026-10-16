import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
export const candidateProfileSchema = z.object({
    headline: text(150), summary: text(4000),
    totalExperience: z.number().min(0).max(999.9).multipleOf(0.1).nullable().optional(),
    city: text(100), state: text(100), country: text(100),
    currentCompany: text(150), currentTitle: text(150),
    skillIds: z.array(z.uuid()).max(100).refine(ids => new Set(ids).size === ids.length, "Skills must be unique").optional(),
}).refine(data => Object.keys(data).length > 0, "At least one profile field is required");
export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;
