import { z } from "zod";

export const createCompanySchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Company name must be at least 2 characters")
        .max(150, "Company name must not exceed 150 characters"),

    website: z
        .string()
        .trim()
        .url("Please provide a valid website URL")
        .max(255)
        .optional(),

    description: z
        .string()
        .trim()
        .max(2000, "Description must not exceed 2000 characters")
        .optional(),
});

export type CreateCompanyInput = z.infer<
    typeof createCompanySchema
>;
export const companyIdSchema = z.object({ companyId: z.uuid() });
export const updateCompanySchema = createCompanySchema.extend({
    website: z.url().max(255).nullable().optional(), description: z.string().trim().max(2000).nullable().optional(),
}).partial().refine(input => Object.keys(input).length > 0, "At least one field is required");
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export const addRecruiterSchema = z.object({ userId: z.uuid() });
