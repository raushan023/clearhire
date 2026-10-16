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
        .pipe(z.email("Please provide a valid email address"))
        .transform((email) => email.toLowerCase()),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(72, "Password must not exceed 72 characters"),

    role: z.enum(["candidate", "employer"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .pipe(z.email("Please provide a valid email address"))
        .transform((email) => email.toLowerCase()),

    password: z
        .string()
        .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;