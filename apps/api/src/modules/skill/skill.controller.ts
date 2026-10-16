import type { Request, Response } from "express";

import { searchSkills } from "./skill.service.js";

export async function getSkills(
    req: Request,
    res: Response
) {
    const search =
        typeof req.query.search === "string"
            ? req.query.search
            : undefined;

    try {
        const skills = await searchSkills(search);

        return res.status(200).json({
            skills,
        });
    } catch (error) {
        console.error("Fetching skills failed:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}