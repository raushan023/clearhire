import type { Request, Response } from "express";

import { getBenefits } from "./benefit.service.js";

export async function listBenefits(
    _req: Request,
    res: Response
) {
    try {
        const benefits = await getBenefits();

        return res.status(200).json({
            benefits,
        });
    } catch (error) {
        console.error("Fetching benefits failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}