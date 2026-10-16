import { z } from "zod";

export const applicationIdParamSchema = z.object({
    applicationId: z.uuid("Invalid application ID"),
});

export const employerApplicationSearchSchema = z.object({
    status: z
        .enum([
            "applied",
            "under_review",
            "shortlisted",
            "interview",
            "final_review",
            "offer",
            "rejected",
            "withdrawn",
        ])
        .optional(),

    page: z.coerce
        .number()
        .int()
        .positive()
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20),
});

export type EmployerApplicationSearchInput =
    z.infer<typeof employerApplicationSearchSchema>;

export const updateApplicationStatusSchema = z.object({
    status: z.enum([
        "under_review",
        "shortlisted",
        "interview",
        "final_review",
        "offer",
        "rejected",
    ]),

    note: z
        .string()
        .trim()
        .max(1000, "Note must not exceed 1000 characters")
        .optional(),
});

export type UpdateApplicationStatusInput =
    z.infer<typeof updateApplicationStatusSchema>;

export const scheduleInterviewSchema = z.object({
    scheduledAt: z.coerce.date(),

    mode: z.enum([
        "video",
        "phone",
        "onsite",
    ]),

    meetingLink: z
        .url("Please provide a valid meeting URL")
        .optional(),

    location: z
        .string()
        .trim()
        .max(500)
        .optional(),

    notes: z
        .string()
        .trim()
        .max(2000)
        .optional(),
})
    .refine(
        (data) =>
            data.mode !== "video" ||
            Boolean(data.meetingLink),
        {
            message:
                "Meeting link is required for video interviews",
            path: ["meetingLink"],
        }
    )
    .refine(
        (data) =>
            data.mode !== "onsite" ||
            Boolean(data.location),
        {
            message:
                "Location is required for onsite interviews",
            path: ["location"],
        }
    )
    .refine(
        (data) =>
            data.scheduledAt.getTime() > Date.now(),
        {
            message:
                "Interview must be scheduled in the future",
            path: ["scheduledAt"],
        }
    );

export type ScheduleInterviewInput =
    z.infer<typeof scheduleInterviewSchema>;

export const interviewIdParamSchema = z.object({
    interviewId: z.uuid("Invalid interview ID"),
});

export const rescheduleInterviewSchema = z
    .object({
        scheduledAt: z.coerce.date(),

        mode: z.enum([
            "video",
            "phone",
            "onsite",
        ]),

        meetingLink: z
            .url("Please provide a valid meeting URL")
            .optional(),

        location: z
            .string()
            .trim()
            .max(500)
            .optional(),

        notes: z
            .string()
            .trim()
            .max(2000)
            .optional(),
    })
    .refine(
        (data) =>
            data.mode !== "video" ||
            Boolean(data.meetingLink),
        {
            message:
                "Meeting link is required for video interviews",
            path: ["meetingLink"],
        }
    )
    .refine(
        (data) =>
            data.mode !== "onsite" ||
            Boolean(data.location),
        {
            message:
                "Location is required for onsite interviews",
            path: ["location"],
        }
    )
    .refine(
        (data) =>
            data.scheduledAt.getTime() > Date.now(),
        {
            message:
                "Interview must be scheduled in the future",
            path: ["scheduledAt"],
        }
    );

export type RescheduleInterviewInput =
    z.infer<typeof rescheduleInterviewSchema>;

export const respondToOfferSchema = z.object({
    response: z.enum([
        "offer_accepted",
        "offer_declined",
    ]),
});

export type RespondToOfferInput =
    z.infer<typeof respondToOfferSchema>;