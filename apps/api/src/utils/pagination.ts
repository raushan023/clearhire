import { z } from "zod";

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
export function pagination(page: number, limit: number, total: number) {
    return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
