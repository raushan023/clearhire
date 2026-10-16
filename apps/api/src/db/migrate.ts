import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { applyMigrations } from "./migration-runner.js";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL (direct, non-pooled) is required for migrations");
const url = new URL(rawUrl);
if (url.hostname.includes('-pooler.')) throw new Error("Migrations require a direct database connection");
if (url.hostname.endsWith('.neon.tech') || url.hostname.endsWith('.neon.com')) {
    url.searchParams.set('sslmode', 'verify-full');
    url.searchParams.delete('uselibpqcompat');
} else if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'disable' : 'verify-full');
}
const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10000 });
try {
    await applyMigrations(pool, path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'));
    console.log('Migrations completed successfully');
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
} finally { await pool.end(); }
