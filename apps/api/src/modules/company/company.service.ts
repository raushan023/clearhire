import { pool } from "../../config/database.js";
import type { CreateCompanyInput, UpdateCompanyInput } from "./company.schema.js";

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

function companyResponse(row: Record<string, any>) {
    return { id: row.id, name: row.name, website: row.website, description: row.description,
        membershipRole: row.role, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function listCompanies(userId: string) {
    const result = await pool.query(`SELECT c.*, cm.role FROM companies c JOIN company_members cm ON cm.company_id = c.id
        WHERE cm.user_id = $1 ORDER BY c.name, c.id`, [userId]);
    return result.rows.map(companyResponse);
}
export async function getCompany(userId: string, companyId: string) {
    const result = await pool.query(`SELECT c.*, cm.role FROM companies c JOIN company_members cm ON cm.company_id = c.id
        WHERE c.id = $1 AND cm.user_id = $2`, [companyId, userId]);
    if (!result.rows[0]) throw new Error("COMPANY_ACCESS_DENIED");
    return companyResponse(result.rows[0]);
}
export async function updateCompany(userId: string, companyId: string, input: UpdateCompanyInput) {
    const values: unknown[] = [companyId, userId];
    const fields: string[] = [];
    for (const key of ['name', 'website', 'description'] as const) {
        if (input[key] !== undefined) { values.push(input[key]); fields.push(`${key} = $${values.length}`); }
    }
    const result = await pool.query(`UPDATE companies c SET ${fields.join(', ')}, updated_at = NOW()
        FROM company_members cm WHERE cm.company_id = c.id AND c.id = $1 AND cm.user_id = $2 AND cm.role = 'owner'
        RETURNING c.*, cm.role`, values);
    if (!result.rowCount) throw new Error("COMPANY_OWNER_REQUIRED");
    return companyResponse(result.rows[0]);
}
export async function listCompanyMembers(userId: string, companyId: string) {
    if (!await getCompanyMembership(userId, companyId)) throw new Error("COMPANY_ACCESS_DENIED");
    const result = await pool.query(`SELECT u.id, u.first_name, u.last_name, u.email, cm.role, cm.created_at
        FROM company_members cm JOIN users u ON u.id = cm.user_id WHERE cm.company_id = $1 ORDER BY cm.created_at, u.id`, [companyId]);
    return result.rows.map(m => ({ userId: m.id, firstName: m.first_name, lastName: m.last_name,
        email: m.email, role: m.role, createdAt: m.created_at }));
}
export async function addRecruiter(userId: string, companyId: string, recruiterId: string) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const owner = await client.query(`SELECT c.id FROM companies c JOIN company_members cm ON cm.company_id = c.id
            WHERE c.id = $1 AND cm.user_id = $2 AND cm.role = 'owner' FOR UPDATE OF c`, [companyId, userId]);
        if (!owner.rowCount) throw new Error("COMPANY_OWNER_REQUIRED");
        const user = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'employer'", [recruiterId]);
        if (!user.rowCount) throw new Error("EMPLOYER_NOT_FOUND");
        const result = await client.query(`INSERT INTO company_members(company_id, user_id, role) VALUES ($1, $2, 'recruiter')
            ON CONFLICT DO NOTHING RETURNING user_id`, [companyId, recruiterId]);
        if (!result.rowCount) throw new Error("ALREADY_COMPANY_MEMBER");
        await client.query("COMMIT");
        return { userId: recruiterId, role: "recruiter" };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
}
