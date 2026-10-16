import { z } from "zod";

function hasUniqueValues(values: string[]) {
    return new Set(values).size === values.length;
}

const jobFieldsSchema = z.object({
    companyId: z.uuid(),

    title: z
        .string()
        .trim()
        .min(2)
        .max(150),

    description: z
        .string()
        .trim()
        .min(20),

    employmentType: z.enum([
        "full_time",
        "part_time",
        "contract",
        "internship",
    ]),

    workMode: z.enum([
        "remote",
        "hybrid",
        "onsite",
    ]),

    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),

    country: z
        .string()
        .trim()
        .min(2)
        .max(100),

    experienceMin: z.number().min(0).max(999.9).multipleOf(0.1),
    experienceMax: z.number().min(0).max(999.9).multipleOf(0.1),

    salaryMin: z.number().int().nonnegative(),
    salaryMax: z.number().int().nonnegative(),

    salaryCurrency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
        .transform((value) => value.toUpperCase()),

    salaryPeriod: z.enum([
        "hourly",
        "monthly",
        "yearly",
    ]),

    openings: z.number().int().positive().max(2147483647),

    applicationDeadline: z.coerce.date(),
    decisionDeadline: z.coerce.date(),

    requiredSkillIds: z
        .array(z.uuid())
        .min(1),

    preferredSkillIds: z
        .array(z.uuid())
        .default([]),

    benefitIds: z
        .array(z.uuid())
        .default([]),
});

export const createJobSchema = jobFieldsSchema
    .refine(
        (data) => data.experienceMax >= data.experienceMin,
        {
            message:
                "Maximum experience cannot be less than minimum experience",
            path: ["experienceMax"],
        }
    )
    .refine(
        (data) => data.salaryMax >= data.salaryMin,
        {
            message:
                "Maximum salary cannot be less than minimum salary",
            path: ["salaryMax"],
        }
    )
    .refine(
        (data) =>
            data.decisionDeadline > data.applicationDeadline,
        {
            message:
                "Decision deadline must be after application deadline",
            path: ["decisionDeadline"],
        }
    )
    .refine(
        (data) => hasUniqueValues(data.requiredSkillIds),
        {
            message: "Required skills cannot contain duplicates",
            path: ["requiredSkillIds"],
        }
    )
    .refine(
        (data) => hasUniqueValues(data.preferredSkillIds),
        {
            message: "Preferred skills cannot contain duplicates",
            path: ["preferredSkillIds"],
        }
    )
    .refine(
        (data) => hasUniqueValues(data.benefitIds),
        {
            message: "Benefits cannot contain duplicates",
            path: ["benefitIds"],
        }
    )
    .refine(
        (data) => {
            const required = new Set(data.requiredSkillIds);

            return !data.preferredSkillIds.some(
                (id) => required.has(id)
            );
        },
        {
            message:
                "A skill cannot be both required and preferred",
            path: ["preferredSkillIds"],
        }
    );

export const updateJobSchema = jobFieldsSchema
    .omit({
        companyId: true,
    })
    .extend({
        preferredSkillIds: z.array(z.uuid()),
        benefitIds: z.array(z.uuid()).refine(hasUniqueValues, "Benefits cannot contain duplicates"),
    })
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field must be provided",
        }
    );

export type CreateJobInput =
    z.infer<typeof createJobSchema>;

export type UpdateJobInput =
    z.infer<typeof updateJobSchema>;

export const jobIdParamSchema = z.object({
    jobId: z.uuid("Invalid job ID"),
});

export const jobSearchSchema = z.object({
    search: z
        .string()
        .trim()
        .optional(),

    workMode: z
        .enum(["remote", "hybrid", "onsite"])
        .optional(),

    employmentType: z
        .enum([
            "full_time",
            "part_time",
            "contract",
            "internship",
        ])
        .optional(),

    country: z
        .string()
        .trim()
        .optional(),

    city: z
        .string()
        .trim()
        .optional(),

    experienceMin: z.coerce
        .number()
        .min(0)
        .optional(),

    salaryMin: z.coerce
        .number()
        .int()
        .nonnegative()
        .optional(),

    skillIds: z
        .string()
        .optional()
        .transform((value) =>
            value
                ? value
                    .split(",")
                    .map((id) => id.trim().toLowerCase())
                    .filter(Boolean)
                : []
        )
        .transform(ids => [...new Set(ids)])
        .refine(
            (ids) => ids.every((id) => z.uuid().safeParse(id).success),
            {
                message: "One or more skill IDs are invalid",
            }
        ),

    page: z.coerce
        .number()
        .int()
        .positive()
        .max(1000000)
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20),
});

export type JobSearchInput = z.infer<typeof jobSearchSchema>;

export const employerJobSearchSchema = z.object({
    companyId: z.uuid().optional(),

    status: z
        .enum([
            "draft",
            "open",
            "applications_closed",
            "hiring_in_progress",
            "filled",
            "cancelled",
        ])
        .optional(),

    page: z.coerce
        .number()
        .int()
        .positive()
        .max(1000000)
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20),
});

export type EmployerJobSearchInput = z.infer<typeof employerJobSearchSchema>;

export const updateJobStatusSchema = z.object({
    status: z.enum([
        "applications_closed",
        "hiring_in_progress",
        "filled",
    ]),
});

export type UpdateJobStatusInput =
    z.infer<typeof updateJobStatusSchema>;

export const cancelJobSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(
            10,
            "Please provide a meaningful cancellation reason"
        )
        .max(
            1000,
            "Cancellation reason must not exceed 1000 characters"
        ),
});

export type CancelJobInput =
    z.infer<typeof cancelJobSchema>;

export const repostJobSchema = z
    .object({
        applicationDeadline: z.coerce.date(),
        decisionDeadline: z.coerce.date(),
    })
    .refine(
        (data) =>
            data.applicationDeadline.getTime() >
            Date.now(),
        {
            message:
                "Application deadline must be in the future",
            path: ["applicationDeadline"],
        }
    )
    .refine(
        (data) =>
            data.decisionDeadline >
            data.applicationDeadline,
        {
            message:
                "Decision deadline must be after the application deadline",
            path: ["decisionDeadline"],
        }
    );

export type RepostJobInput =
    z.infer<typeof repostJobSchema>;