import { Pool } from "pg";

const connectionString =
    process.env.DATABASE_URL_POOLED;

if (!connectionString) {
    throw new Error(
        "DATABASE_URL_POOLED is not defined"
    );
}

export const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});