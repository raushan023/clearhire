import { z } from "zod";
import { platformIso, validPlatformDate } from "./presentation";
export const deadlineFields = {
  applicationDeadline: z
    .string()
    .refine(validPlatformDate, "Enter a valid date and time."),
  decisionDeadline: z
    .string()
    .refine(validPlatformDate, "Enter a valid date and time."),
};
export function deadlinesOrdered(values: {
  applicationDeadline: string;
  decisionDeadline: string;
}) {
  return (
    validPlatformDate(values.applicationDeadline) &&
    validPlatformDate(values.decisionDeadline) &&
    platformIso(values.decisionDeadline) >
      platformIso(values.applicationDeadline)
  );
}
export const jobFormSchema = z
  .object({
    companyId: z.uuid("Choose a company."),
    title: z.string().trim().min(2).max(150),
    description: z.string().trim().min(20),
    employmentType: z.enum([
      "full_time",
      "part_time",
      "contract",
      "internship",
    ]),
    workMode: z.enum(["remote", "hybrid", "onsite"]),
    city: z.string().trim().max(100),
    state: z.string().trim().max(100),
    country: z.string().trim().min(2).max(100),
    experienceMin: z.number().min(0).max(999.9).multipleOf(0.1),
    experienceMax: z.number().min(0).max(999.9).multipleOf(0.1),
    salaryMin: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    salaryMax: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    salaryCurrency: z
      .string()
      .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code."),
    salaryPeriod: z.enum(["hourly", "monthly", "yearly"]),
    openings: z.number().int().min(1).max(2147483647),
    ...deadlineFields,
    requiredSkillIds: z
      .array(z.uuid())
      .min(1, "Select at least one required skill."),
    preferredSkillIds: z.array(z.uuid()),
    benefitIds: z.array(z.uuid()),
  })
  .refine((v) => v.experienceMax >= v.experienceMin, {
    path: ["experienceMax"],
    message: "Maximum experience must be at least the minimum.",
  })
  .refine((v) => v.salaryMax >= v.salaryMin, {
    path: ["salaryMax"],
    message: "Maximum salary must be at least the minimum.",
  })
  .refine(deadlinesOrdered, {
    path: ["decisionDeadline"],
    message: "Decision deadline must follow the application deadline.",
  })
  .refine(
    (v) => !v.preferredSkillIds.some((id) => v.requiredSkillIds.includes(id)),
    {
      path: ["preferredSkillIds"],
      message: "A skill cannot be both required and preferred.",
    },
  );
export type JobFormValues = z.infer<typeof jobFormSchema>;
export const repostSchema = z
  .object(deadlineFields)
  .refine(deadlinesOrdered, {
    path: ["decisionDeadline"],
    message: "Decision deadline must follow application deadline.",
  })
  .refine(
    (v) =>
      validPlatformDate(v.applicationDeadline) &&
      new Date(platformIso(v.applicationDeadline)).getTime() > Date.now(),
    {
      path: ["applicationDeadline"],
      message: "Application deadline must be in the future.",
    },
  );
export const cancellationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Provide a meaningful reason (at least 10 characters).")
    .max(1000),
});
export const interviewSchema = z
  .object({
    scheduledAt: z
      .string()
      .refine(validPlatformDate, "Enter a valid time.")
      .refine(
        (v) =>
          validPlatformDate(v) &&
          new Date(platformIso(v)).getTime() > Date.now(),
        "Choose a future time.",
      ),
    mode: z.enum(["video", "phone", "onsite"]),
    meetingLink: z.union([z.url(), z.literal("")]),
    location: z.string().trim().max(500),
    notes: z.string().trim().max(2000),
  })
  .refine((v) => v.mode !== "video" || !!v.meetingLink, {
    path: ["meetingLink"],
    message: "Video interviews require a meeting link.",
  })
  .refine((v) => v.mode !== "onsite" || !!v.location, {
    path: ["location"],
    message: "Onsite interviews require a location.",
  });
