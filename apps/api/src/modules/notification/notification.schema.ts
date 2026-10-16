import { z } from "zod";

export const notificationIdParamSchema = z.object({
    notificationId: z.uuid("Invalid notification ID"),
});