import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const directory = new URL('./migrations/', import.meta.url);
for (const file of (await readdir(directory)).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort()) {
    console.log(`\n-- ${file}\n${await readFile(fileURLToPath(new URL(file, directory)), 'utf8')}`);
}
// Read-only source plan. This deliberately does not load dotenv or connect to a DB.
