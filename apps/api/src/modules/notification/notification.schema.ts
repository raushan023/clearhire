import { z } from "zod";

export const notificationIdParamSchema = z.object({
    notificationId: z.uuid("Invalid notification ID"),
});
export const notificationSearchSchema = z.object({
    page: z.coerce.number().int().positive().max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationSearchInput = z.infer<typeof notificationSearchSchema>;
