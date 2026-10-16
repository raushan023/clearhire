import "dotenv/config";
import app from "./app.js";
import { pool } from "./config/database.js";

if (!process.env.JWT_ACCESS_SECRET) throw new Error("JWT_ACCESS_SECRET is not defined");
const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
const server = app.listen(port, () => console.log(`ClearHire API listening on port ${port}`));
let stopping = false;
function shutdown() {
    if (stopping) return;
    stopping = true;
    console.log('Draining API connections');
    const timeout = setTimeout(() => {
        server.closeAllConnections();
        console.error('API shutdown timed out');
        process.exit(1);
    }, 10000);
    timeout.unref();
    server.close(() => {
        pool.end().then(() => { clearTimeout(timeout); process.exitCode = 0; })
            .catch(() => { clearTimeout(timeout); console.error('Database shutdown failed'); process.exitCode = 1; });
    });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
server.on('error', () => { console.error('API listener failed'); void pool.end(); process.exitCode = 1; });
