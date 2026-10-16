# ClearHire

Transparent recruitment workflows using Express, TypeScript, PostgreSQL, and a separate BullMQ/Redis worker. Frontend implementation has not started.

## Requirements and setup

Use Node.js 22.23 or later with npm workspaces, PostgreSQL 14+ with `pg_trgm`, and a Redis TCP/TLS connection supported by BullMQ. Install dependencies using a Node binary matching your machine architecture:

```sh
npm ci
```

Copy the workspace `.env.example` files to `.env` only for a new setup; preserve any existing files and values. The API and worker use `dotenv/config` directly. Workspace commands run from their workspace directories, so `apps/api/.env` and `apps/worker/.env` are the relevant local files. The root `.env.example` documents the key names for process environments; the root's older `JWT_SECRET` and Redis REST variables are not used by this backend.

API requires `DATABASE_URL_POOLED` and `JWT_ACCESS_SECRET`. Migration execution additionally requires `DATABASE_URL`, the direct non-pooler connection. Worker requires `DATABASE_URL_POOLED` and `REDIS_URL` (TCP `redis://` or TLS `rediss://`, not a REST URL/token). `PLATFORM_TIMEZONE` defaults to `Asia/Kolkata`.

## Database review and deployment

No remote migration is run automatically by startup, build, or tests. Review [the migration notes](docs/backend-implementation.md) before migration approval. Print all migration source without loading credentials or connecting:

```sh
npm run db:plan --workspace=api
```

Only after approving the SQL for the intended database, run:

```sh
npm run db:migrate --workspace=api
```

This command uses `DATABASE_URL`, takes a session advisory lock, records filenames/checksums, and runs each unapplied migration in its own transaction. Neon migrations must use its direct endpoint because a transaction pooler cannot preserve the session lock. Migration files are also copied into the API build output.

New backend source requires migrations 021–024 before serving requests. Migration 013 contains a documented one-line idempotency repair to the pre-release history. Existing migration filenames remain unchanged.

## Development and checks

In separate terminals:

```sh
npm run dev:api
npm run dev:worker
```

The API defaults to port 4000. `/health` checks the process; `/health/db` checks database connectivity. Production commands are `npm run build`, then `npm start --workspace=api` and `npm start --workspace=worker` in separate processes.

```sh
npm run check
npm run build
```

`check` typechecks API, worker, and API tests, then runs the unit tests. There is no new test framework: tests use `node:test` with the existing `tsx` loader. Root scripts do not apply migrations.

For integration tests, supply a separate LOCAL PostgreSQL database whose name ends in `_test`, with permission to create schemas and the `pg_trgm` extension. Example using a local database with normal local authentication:

```sh
TEST_DATABASE_URL='postgresql://localhost/clearhire_test' npm run test:integration
```

The suite accepts only explicit `postgres://` or `postgresql://` URLs using `localhost`, `127.0.0.1`, or `[::1]` and a plain database name ending in `_test`. Input query parameters are all rejected, including `host`, `hostaddr`, `service`, and `options`; even `?sslmode=disable` must be omitted. Remote/service hosts, encoded database names, and ambiguous URLs fail before connecting. The harness sets its own local SSL/search-path options, ignores application `.env` files, and uses random schemas. It covers fresh bootstrap, a legacy 001–020 upgrade, service SQL, and HTTP authorization. Integration files run serially to avoid racing extension creation; the business concurrency cases still run simultaneous requests. With no `TEST_DATABASE_URL`, it reports a skip, not a successful database verification. Test schemas are retained for inspection; the suite performs no schema/table drop or truncate. Checksum tests remove only their temporary copies of migration files. Redis is unnecessary for these tests because worker SQL jobs are invoked directly; BullMQ delivery/retry behavior still needs a Redis-backed smoke test.

## Backend API and policies

See [backend API](docs/backend-api.md) for added endpoints and request conventions, and [implementation/readiness notes](docs/backend-implementation.md) for migration review, tests, known limits, and external configuration still required.

JWTs expire after 15 minutes; users log in again. Refresh tokens, token revocation, and session storage are deliberately outside this MVP.

Resume storage is intentionally unconfigured. Valid uploads return 503 until a private storage provider is selected and its adapter/configuration is supplied. No credentials were invented and no real cloud upload was attempted.

Correction-pass policies: routes use explicit actions with normal Express HEAD/trailing-slash behavior. Closed-job saves return 409 (missing/draft jobs remain 404). Deadline edits and late application resolution preserve a missed-deadline marker before changing the evidence; new markers use the crossed deadline, and existing markers stay unchanged. Employers can read a candidate's current profile/resume only through an unresolved application. Historical application access retains the application/timeline, not live profile/resume access. No immutable application-time resume snapshot is stored.

Local verification is required before Neon migration approval. This environment attempted `npm run check`, `npm run build`, and `npm run test:integration`; all failed before execution with `env: node: Bad CPU type in executable`. No typecheck, build, or test pass is claimed. See the implementation notes for the exact verification order and remaining storage/Redis checks.
