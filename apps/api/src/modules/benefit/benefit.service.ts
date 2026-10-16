import { pool } from "../../config/database.js";

export async function getBenefits() {
    const result = await pool.query(
        `
            SELECT
                id,
                name
            FROM benefits
            ORDER BY name
        `
    );

    return result.rows;
}