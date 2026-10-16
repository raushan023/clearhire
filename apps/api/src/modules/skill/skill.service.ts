import { pool } from "../../config/database.js";

export async function searchSkills(search?: string) {
    const normalizedSearch = search?.trim();

    if (!normalizedSearch) {
        const result = await pool.query(
            `
                SELECT
                    id,
                    name
                FROM skills
                ORDER BY name
                LIMIT 50
            `
        );

        return result.rows;
    }

    const result = await pool.query(
        `
            SELECT
                id,
                name
            FROM skills
            WHERE name ILIKE $1
               OR normalized_name ILIKE $2
            ORDER BY
                CASE
                    WHEN LOWER(name) = LOWER($3) THEN 0
                    WHEN LOWER(name) LIKE LOWER($4) THEN 1
                    ELSE 2
                END,
                name
            LIMIT 20
        `,
        [
            `%${normalizedSearch}%`,
            `%${normalizeSkillSearch(normalizedSearch)}%`,
            normalizedSearch,
            `${normalizedSearch}%`,
        ]
    );

    return result.rows;
}

function normalizeSkillSearch(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}