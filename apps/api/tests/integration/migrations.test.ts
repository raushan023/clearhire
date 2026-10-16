import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { applyMigrations } from '../../src/db/migration-runner.js';
import { localTestDatabaseUrl } from '../helpers/local-test-database.js';

const testUrl = process.env.TEST_DATABASE_URL;
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations');
test('PostgreSQL migration upgrade regression suite', { skip: !testUrl }, async t => {
    const url = localTestDatabaseUrl(testUrl!);
    const admin = new Pool({ connectionString: url.toString() });
    const schema = `clearhire_upgrade_${randomUUID().replaceAll('-', '')}`;
    let db: Pool | undefined;
    try {
        await admin.query('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public');
        await admin.query(`CREATE SCHEMA ${schema}`);
        url.searchParams.set('options', `-c search_path=${schema},public`);
        const scoped = new Pool({ connectionString: url.toString() });
        db = scoped;
        const files = (await fs.readdir(migrations)).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
        const legacy = files.filter(f => Number(f.slice(0, 3)) <= 20);
        await scoped.query(`CREATE TABLE schema_migrations (id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
        // Reproduce a filename-only legacy ledger. 012 already created the
        // index; 013 is recorded as applied, as in the existing dev database.
        const client = await scoped.connect();
        try {
            for (const filename of legacy) {
                await client.query('BEGIN');
                if (!filename.startsWith('013_')) await client.query(await fs.readFile(path.join(migrations, filename), 'utf8'));
                await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
                await client.query('COMMIT');
            }
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        const employer = randomUUID(), candidate = randomUUID(), company = randomUUID(), job = randomUUID(), application = randomUUID();
        await scoped.query(`INSERT INTO users(id, email, password_hash, role) VALUES
            ($1, 'legacy-employer@example.test', 'fixture', 'employer'),
            ($2, 'legacy-candidate@example.test', 'fixture', 'candidate')`, [employer, candidate]);
        await scoped.query("INSERT INTO companies(id, name) VALUES ($1, 'Legacy company')", [company]);
        await scoped.query("INSERT INTO company_members(company_id, user_id, role) VALUES ($1, $2, 'owner')", [company, employer]);
        await scoped.query(`INSERT INTO jobs(id, company_id, created_by, title, description, employment_type, work_mode, country,
            experience_min, experience_max, salary_min, salary_max, salary_currency, application_deadline, decision_deadline, status)
            VALUES ($1, $2, $3, 'Legacy role', 'Preserve this history', 'full_time', 'remote', 'India',
            1, 3, 100, 200, 'INR', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', 'open')`, [job, company, employer]);
        await scoped.query("INSERT INTO applications(id, job_id, candidate_id, status) VALUES ($1, $2, $3, 'rejected')", [application, job, candidate]);
        await scoped.query(`INSERT INTO application_events(application_id, changed_by, from_status, to_status, note)
            VALUES ($1, $2, 'applied', 'rejected', 'Original decision')`, [application, employer]);
        await scoped.query(`INSERT INTO notifications(user_id, job_id, application_id, type, title, message)
            VALUES ($1, $2, $3, 'feedback_overdue', 'Legacy notice', 'Preserve this notice')`, [employer, job, application]);
        const tables = ['users', 'companies', 'company_members', 'jobs', 'applications', 'application_events', 'notifications'];
        const before = new Map<string, unknown>();
        for (const table of tables) before.set(table, (await scoped.query(`SELECT * FROM ${table} ORDER BY id`)).rows);
        const old013 = (await scoped.query("SELECT id, filename, executed_at FROM schema_migrations WHERE filename LIKE '013_%'")).rows;

        await t.test('legacy 001–020 upgrades without rerunning 013 and preserves existing data', async () => {
            await applyMigrations(scoped, migrations);
            assert.equal((await scoped.query('SELECT 1 FROM schema_migrations')).rowCount, files.length);
            assert.deepEqual((await scoped.query("SELECT id, filename, executed_at FROM schema_migrations WHERE filename LIKE '013_%'")).rows, old013);
            // Rerunning repaired 013 after 020 would incorrectly recreate this.
            assert.equal((await scoped.query("SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = 'idx_notifications_feedback_overdue_unique'", [schema])).rowCount, 0);
            for (const table of tables) assert.deepEqual((await scoped.query(`SELECT * FROM ${table} ORDER BY id`)).rows, before.get(table), table);
        });
        await t.test('legacy checksum baseline records current file hashes once and repeated runs are idempotent', async () => {
            const ledger = await scoped.query('SELECT filename, checksum, executed_at FROM schema_migrations ORDER BY filename');
            for (const row of ledger.rows) {
                const sql = await fs.readFile(path.join(migrations, row.filename), 'utf8');
                assert.equal(row.checksum, createHash('sha256').update(sql).digest('hex'), row.filename);
            }
            await applyMigrations(scoped, migrations);
            assert.deepEqual((await scoped.query('SELECT filename, checksum, executed_at FROM schema_migrations ORDER BY filename')).rows, ledger.rows);
        });
        await t.test('checksum mismatch rejects modified historical SQL without changing data or ledger', async () => {
            // Alter only a temporary copy, never repository migration files.
            const copy = await fs.mkdtemp(path.join(os.tmpdir(), 'clearhire-migration-checksum-'));
            try {
                for (const filename of files) await fs.copyFile(path.join(migrations, filename), path.join(copy, filename));
                await fs.appendFile(path.join(copy, files[0]), '\n-- Test-only checksum mismatch\n');
                const ledger = (await scoped.query('SELECT * FROM schema_migrations ORDER BY filename')).rows;
                await assert.rejects(() => applyMigrations(scoped, copy), /Migration checksum mismatch: 001_/);
                assert.deepEqual((await scoped.query('SELECT * FROM schema_migrations ORDER BY filename')).rows, ledger);
                for (const table of tables) assert.deepEqual((await scoped.query(`SELECT * FROM ${table} ORDER BY id`)).rows, before.get(table), table);
            } finally { await fs.rm(copy, { recursive: true, force: true }); }
        });
    } finally {
        await db?.end(); await admin.end();
        console.log(`Local upgrade schema retained for inspection: ${schema}`);
    }
});
