# ClearHire

Transparent recruitment workflows using Express, TypeScript, PostgreSQL, a separate BullMQ/Redis worker, and a React/Vite web workspace.

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

Database integration verification remains separate from source checks and is required before any Neon migration approval. The current frontend pass successfully ran workspace checks/builds and frontend browser tests; see [frontend verification](docs/frontend-implementation.md). Earlier backend runtime limitations are historical notes, not the current Node status. Private storage, Redis, and live database verification still require their own setup.

## Web workspace

The React/TypeScript frontend lives in `apps/web` and talks directly to the existing Express API. It uses React Router, TanStack Query, React Hook Form/Zod, and Tailwind CSS through its official Vite plugin. See [frontend implementation and review](docs/frontend-implementation.md) for routes, contracts, tests, and limitations.

After `npm ci`, start the existing API and the web app in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

Vite prints the frontend development URL. The default public API base is `/api`, proxied to the existing local API on port 4000 during development. `apps/web/.env.example` documents `VITE_API_BASE_URL`; an absolute Express URL must include its `/api` prefix. No frontend environment file is required for the default local proxy. Never place database credentials or JWT signing secrets in Vite environment variables.

```sh
npm run typecheck --workspace=web
npm test --workspace=web
npm run build --workspace=web
npm exec --workspace=web -- playwright install chromium
npm run test:browser --workspace=web
```

Browser tests use a local Vite server and explicitly mocked API contracts, without database connections or real account credentials. `npm run check` includes frontend typechecks/unit tests, and `npm run build` includes the web production build. Browser tests are a separate explicit command. Frontend output is `apps/web/dist`. No hosting or deployment configuration was applied.
