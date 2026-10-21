import { z } from "zod";

export const registerSchema = z.object({
    firstName: z
        .string()
        .trim()
        .min(1, "First name is required")
        .max(100, "First name must not exceed 100 characters"),

    lastName: z
        .string()
        .trim()
        .min(1, "Last name is required")
        .max(100, "Last name must not exceed 100 characters"),
    email: z
        .string()
        .trim()
        .max(255)
        .pipe(z.email("Please provide a valid email address"))
        .transform((email) => email.toLowerCase()),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes"),

    role: z.enum(["candidate", "employer"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .max(255)
        .pipe(z.email("Please provide a valid email address"))
        .transform((email) => email.toLowerCase()),

    password: z
        .string()
        .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Preserve international input formatting; blank input explicitly clears the optional phone.
export const phoneSchema = z.string().trim().max(64)
    .refine(value => value === "" || (/^\+?[0-9() .\/-]+$/.test(value) &&
        value.replace(/\D/g, "").length >= 3 && value.replace(/\D/g, "").length <= 20),
        "Enter a phone number using digits, an optional leading +, and common separators")
    .transform(value => value || null).nullable();

export const updateCurrentUserSchema = z.object({
    firstName: registerSchema.shape.firstName.optional(),
    lastName: registerSchema.shape.lastName.optional(),
    email: registerSchema.shape.email.optional(),
    phone: phoneSchema.optional(),
}).strict().refine(value => Object.values(value).some(field => field !== undefined),
    "Provide at least one account field");

export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserSchema>;
