import { pool } from "../../config/database.js";
import type { CreateCompanyInput } from "./company.schema.js";

export async function createCompany(
    userId: string,
    input: CreateCompanyInput
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const companyResult = await client.query(
            `
                INSERT INTO companies (
                    name,
                    website,
                    description
                )
                VALUES ($1, $2, $3)
                RETURNING
                    id,
                    name,
                    website,
                    description,
                    created_at
            `,
            [
                input.name,
                input.website ?? null,
                input.description ?? null,
            ]
        );

        const company = companyResult.rows[0];

        await client.query(
            `
                INSERT INTO company_members (
                    company_id,
                    user_id,
                    role
                )
                VALUES ($1, $2, 'owner')
            `,
            [
                company.id,
                userId,
            ]
        );

        await client.query("COMMIT");

        return {
            id: company.id,
            name: company.name,
            website: company.website,
            description: company.description,
            createdAt: company.created_at,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getCompanyMembership(
    userId: string,
    companyId: string
) {
    const result = await pool.query(
        `
            SELECT
                company_id,
                user_id,
                role
            FROM company_members
            WHERE company_id = $1
              AND user_id = $2
        `,
        [companyId, userId]
    );

    return result.rows[0] ?? null;
}