import { Pool } from "pg";

const rawUrl = process.env.DATABASE_URL_POOLED;
if (!rawUrl) throw new Error("DATABASE_URL_POOLED is not defined");
const url = new URL(rawUrl);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
// Neon supports certificate/hostname verification using Node's trusted CAs.
// Put TLS options in one place: pg connection-string settings override ssl objects.
if (url.hostname.endsWith('.neon.tech') || url.hostname.endsWith('.neon.com')) {
    url.searchParams.set('sslmode', 'verify-full');
    url.searchParams.delete('uselibpqcompat');
} else if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', local ? 'disable' : 'verify-full');
}
export const pool = new Pool({ connectionString: url.toString(), max: 10,
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
pool.on('error', () => console.error('Unexpected idle database connection error'));
