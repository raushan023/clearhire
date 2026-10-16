import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDirectory = path.join(__dirname, "migrations");

async function runMigrations() {
    const client = await pool.connect();

    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        const files = await fs.readdir(migrationsDirectory);

        const migrationFiles = files
            .filter((file) => file.endsWith(".sql"))
            .sort();

        for (const filename of migrationFiles) {
            const migrationExists = await client.query(
                `
          SELECT 1
          FROM schema_migrations
          WHERE filename = $1
        `,
                [filename]
            );

            if (migrationExists.rowCount) {
                console.log(`Skipping ${filename} (already applied)`);
                continue;
            }

            console.log(`Running ${filename}...`);

            const filePath = path.join(migrationsDirectory, filename);
            const sql = await fs.readFile(filePath, "utf8");

            await client.query("BEGIN");

            try {
                await client.query(sql);

                await client.query(
                    `
            INSERT INTO schema_migrations (filename)
            VALUES ($1)
          `,
                    [filename]
                );

                await client.query("COMMIT");

                console.log(`Applied ${filename}`);
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }

        console.log("Migrations completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();