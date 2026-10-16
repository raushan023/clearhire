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