import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Pool } from "pg";

// Session advisory locks require a direct connection, not a transaction pooler.
export async function applyMigrations(pool: Pool, directory: string) {
    const client = await pool.connect();
    let locked = false;
    try {
        await client.query("SELECT pg_advisory_lock(824937102)");
        locked = true;
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY, filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
        let checksumsAvailable = (await client.query(`SELECT 1 FROM pg_attribute
            WHERE attrelid = 'schema_migrations'::regclass AND attname = 'checksum' AND NOT attisdropped`)).rowCount !== 0;
        const files = (await fs.readdir(directory)).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
        if (new Set(files.map(f => f.slice(0, 3))).size !== files.length) throw new Error("Duplicate migration sequence");
        for (const filename of files) {
            const sql = await fs.readFile(path.join(directory, filename), "utf8");
            const checksum = createHash("sha256").update(sql).digest("hex");
            const existing = await client.query("SELECT to_jsonb(m)->>'checksum' AS checksum FROM schema_migrations m WHERE filename = $1", [filename]);
            if (existing.rowCount) {
                if (existing.rows[0].checksum && existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${filename}`);
                continue;
            }
            await client.query("BEGIN");
            try {
                await client.query(sql);
                if (!checksumsAvailable) {
                    checksumsAvailable = (await client.query(`SELECT 1 FROM pg_attribute
                        WHERE attrelid = 'schema_migrations'::regclass AND attname = 'checksum' AND NOT attisdropped`)).rowCount !== 0;
                }
                if (checksumsAvailable) {
                    await client.query("INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)", [filename, checksum]);
                } else {
                    await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [filename]);
                }
                await client.query("COMMIT");
                console.log(`Applied ${filename}`);
            } catch (error) {
                await client.query("ROLLBACK");
                const code = (error as { code?: string }).code ?? "UNKNOWN";
                throw new Error(`Migration ${filename} failed (${code}); transaction rolled back`);
            }
        }
        if (checksumsAvailable) {
            for (const filename of files) {
                const sql = await fs.readFile(path.join(directory, filename), 'utf8');
                const checksum = createHash('sha256').update(sql).digest('hex');
                const result = await client.query('UPDATE schema_migrations SET checksum = $2 WHERE filename = $1 AND checksum IS NULL', [filename, checksum]);
                if (result.rowCount) console.log(`Baselined legacy migration: ${filename}`);
            }
        }
    } finally {
        try { if (locked) await client.query("SELECT pg_advisory_unlock(824937102)"); }
        finally { client.release(); }
    }
}
