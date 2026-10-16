# Backend implementation and readiness

Backend source work only. No frontend, commit, push, remote migration, or cloud upload was performed. Existing `.env` values were preserved. Runtime verification remains pending because this execution environment cannot execute its installed x86_64 Node binaries on arm64 (`Bad CPU type`). Do not describe these changes as deployed or verified feature-complete until the checks below pass.

## Defect repairs

The source fixes duplicate migration-index creation, malformed application-transition and feedback-obligation SQL, PATCH relationship data loss/empty PATCH acceptance, terminal withdrawal, cancellation status constraints/types/filters, historical candidate job access, manual intake-closure metadata, capacity validation during opening edits, draft deadline marking, and missing pending offers in initial reminders.

Lifecycle mutations consistently acquire the parent job before application/interview locks. Offer issuance, offer responses, job fill/cancellation, and opening edits therefore serialize through the same job lock. Each multi-write business operation uses one PostgreSQL client for its transaction. Cancellation preserves resolved applications and interview history. Candidate detail responses omit actor IDs.

Other repairs include byte-length password validation, handling both email unique indexes, known canonical-ID constraint failures as client errors, camelCase registration/job update responses, interview reschedule eligibility, and paginated notification history.

## Features

Candidate profiles and canonical skills, saved jobs, employer company/member management, company-scoped employer application detail, private resume domain/API/storage boundary, and conservative deterministic duplicate active-job protection are implemented in source. Profile and resume reads are private or accessible through an authorized unresolved application. Historical application access alone no longer authorizes live profile/resume reads.

Duplicate policy: normalize Unicode/text whitespace/case and hash title, description, employment/work mode, location, experience, compensation, canonical skills, and benefits using SHA-256. Dates and opening counts do not distinguish an otherwise identical role. Only the same company's `open`, `applications_closed`, and `hiring_in_progress` postings block a duplicate. Drafts may coexist; checks run at publication and published-content edits. Filled/cancelled history never blocks a new cycle. A company lock serializes checks, including legacy rows with NULL hashes; a partial unique index also protects populated hashes. No fuzzy threshold, embeddings, or AI is used.

## Migrations awaiting review and approval

None of these changes has been executed against Neon:

| File | Change |
|---|---|
| `013_add_feedback_notification_unique_index.sql` | Historical exception: `CREATE UNIQUE INDEX IF NOT EXISTS`, because 012 already creates the same index. This preserves existing schema and permits fresh bootstrap to reach 020. Already-applied filenames remain skipped. |
| `021_add_job_cancelled_application_status.sql` | Replace application/application-event status checks to admit the system-generated `job_cancelled` outcome. No rows are deleted. |
| `022_create_candidate_mvp.sql` | Add candidate profiles, canonical profile skills, saved jobs, and private active-resume metadata. |
| `023_add_active_job_hash_uniqueness.sql` | Add partial company/content-hash uniqueness for active postings. Legacy NULL hashes remain unchanged and are checked by the service. |
| `024_add_migration_checksums.sql` | Add the nullable checksum column to migration bookkeeping; legacy applied filenames are baselined once. |

Migration 024 versions the bookkeeping column change. The runner baselines old applied filenames once and checks stored checksums on subsequent runs; it does not rerun applied SQL. Review the bookkeeping migration alongside the business-schema changes. There are no production table drops, deletes, truncates, or hash backfills. New status checks scan existing data; plan the normal deployment window for PostgreSQL table locks.

Use the direct Neon connection for migration execution. A session advisory lock serializes runners; every SQL file and its tracking record commit together. Diagnostics identify the failing file and SQLSTATE. Existing legacy rows without checksums can only be baselined, not retroactively authenticated. Applied files other than the explicitly approved 013 repair were not edited.

Review commands:

```sh
npm run db:plan --workspace=api
```

Do not execute `npm run db:migrate --workspace=api` against Neon until the user approves these files. Deploy migrations before the new API/worker source.

## Worker and operations

Daily schedule remains Asia/Kolkata 00:05 closure, 00:10 deadline marking, 00:15 initial warnings, 00:20 escalations. No minute polling was introduced. Deadline markers are only set once for published active jobs with unresolved applications. The API also captures this in the same SQL statement as edits, job status/cancellation, and application transitions/resolution, under the existing parent job lock and inside the same transaction. Job SET expressions read the old job deadline/status, and application mutations use a data-modifying CTE reading the pre-change unresolved applications, avoiding a separate-query timing gap. This preserves an overdue original deadline before an extension or late resolution can remove the evidence during worker downtime. New markers use the actual crossed `decision_deadline`; existing markers are never rewritten. Drafts, terminal jobs, future deadlines, and jobs without unresolved applications do not acquire a new marker. There is no reconstruction of already-lost historical crossings or changes made by direct SQL outside these paths. Initial/escalation queries include pending offers and stop when all outcomes resolve. The 24/72-hour thresholds now use the crossed deadline for new markers; after downtime multiple stages may already be due when scanning resumes. Warnings remain unique per recipient/job/stage. The old scheduler identifier `close-expired-applications` describes passed deadlines and is retained for BullMQ compatibility; no current SQL treats `expired` as a job status.

BullMQ defaults now include three attempts, exponential backoff starting at five seconds, completed-job retention of seven days/1,000 jobs, and failed-job retention of thirty days/5,000 jobs. API and worker drain connections on termination with timeouts and close their pools. The worker explicitly uses ESM/NodeNext.

Neon supports certificate and hostname verification: https://neon.com/docs/security/security-overview and https://node-postgres.com/features/ssl. Both pools and the migration CLI use `sslmode=verify-full` for Neon rather than `rejectUnauthorized: false`; actual Neon connectivity has not been tested here. Local databases default to non-TLS, while other hosts use explicit connection-string TLS settings or default to verify-full. No `.env` values were changed.

## Verification

Added twelve unit cases and twenty-nine PostgreSQL integration scenarios using `node:test`, the existing `tsx`, and a local, explicitly selected `*_test` database. Integration coverage includes fresh/repeated migrations, legacy 001–020 upgrades, safely skipping 013, row preservation, checksum baseline/mismatch, trailing-slash and HEAD semantics, parser statuses, closed-save conflicts, current-data privacy after every final outcome, concurrent fill/cancel, opening reduction/offer and cancel/accept outcomes, content-edit hash refresh/collision rollback, cross-company duplicates and repost protection, duplicate registration/application, omitted PATCH preservation/rollback, authorization boundaries and HTTP responses, illegal transitions, terminal withdrawal, repeated offer responses, concurrent offer/publish capacity, opening reductions, fill requirements, closure metadata, historical/cancellation access, cancellation interview cleanup, independent reposts, reschedule restrictions, pending-offer accountability, idempotent workers, escalation suppression after resolution, deadline-history preservation, profiles/saved jobs/company roles/notification ownership, and private resume replacement/access. Integration schemas are retained; no schema/table deletion or truncation runs. Checksum tests delete only their own temporary migration-file copies.

Successfully performed: source/diff review, `git diff --check` (plus whitespace review for untracked additions), parsing seven JSON manifests/configs, verifying 136 relative import targets across 63 TypeScript files, dependency-manifest comparison, source test-count checks, and confirmation that no tracked secret files changed. These are static checks, not a TypeScript compilation or runtime test result. No remote database or Redis execution occurred.

Across the implementation/review work, attempted but could not execute due to `env: node: Bad CPU type in executable`:

```sh
npm run build --workspace=api
npm run build --workspace=worker
npm run check
npm run test:integration
npm run build
```

After selecting a working local Node installation, run in VS Code's terminal:

```sh
npm ci
npm run check
npm run build
TEST_DATABASE_URL='postgresql://localhost/clearhire_test' npm run test:integration
```

Create/provide the dedicated local test database first using your local PostgreSQL tooling. A skipped integration suite is not a passed SQL verification. The tests do not use dotenv or fall back to Neon URLs. Input URLs must use an explicit PostgreSQL scheme, an exact loopback hostname (`localhost`, `127.0.0.1`, `[::1]`), a plain `*_test` database name, and no query parameters/fragment. All host/service/options overrides and ambiguous URLs fail closed before constructing a pool. The harness adds its own local connection options after validation. Test files run serially to avoid extension-creation races; explicit concurrent business calls remain parallel. Follow with an approved Neon migration and API/worker smoke test, including actual Redis scheduling/retries, before release.

## Targeted correction pass

No migration SQL or `.env` values changed in this pass. The earlier 013 repair and pending 021–024 remain the only migration changes. Existing databases with 001–020 recorded should apply 021, 022, 023, then 024 through the runner. Do not rerun 013 manually after 020: that would recreate the obsolete narrower index. The runner skips an applied 013 filename and, after 024, baselines its previously NULL checksum to reviewed repository content. A populated checksum that disagrees is an error, not permission to overwrite history. Fresh databases run 001–024, with repaired 013 doing nothing because 012 already created the index. Approval remains conditional on successful local fresh and legacy verification and review of the target ledger/data, including possible existing non-NULL hash duplicates before 023.

Controllers now map one action per route for candidate profile/saved jobs, companies/members, and resume operations. Nearby controllers were searched for method/path dispatch; none remains. Standard GET handlers support automatic HEAD and trailing slashes. Parser error mapping recognizes only known parser failure types; arbitrary `status` properties on server errors do not become client responses. Closed-save 409 now matches a business-state conflict; drafts/missing/private candidate resources remain concealed as 404 and existing employer permission failures remain 403.

Privacy decision: keep one current profile/resume without adding storage snapshots. Employer live-data reads require a company-authorized unresolved application. Every resolved outcome, including accepted offers, suppresses current profile/resume metadata and prevents the application resume download, while keeping application history and candidate basic identity/contact fields already present in the historical application API. Row locks hold this authorization decision through the read. This minimizes later profile/CV exposure but does not provide application-time provenance: unresolved applications see later replacements, and prior downloads cannot be revoked. Immutable snapshots and retention policy remain future work; no object-storage redesign was introduced.

Correction files: `apps/api/src/app.ts`, `middleware/error.middleware.ts`, candidate controllers/routes/service, company controllers/routes, resume controllers/service, employer-job routes, application service/privacy policy, job service/accountability helper; worker deadline marking; API integration script; test files/helper; README and the two backend documents.

This pass attempted exactly `npm run check`, `npm run build`, and `npm run test:integration`; each exited 126 before running with `env: node: Bad CPU type in executable`. Source/static checks are not a substitute for a TypeScript compile or executed PostgreSQL/HTTP tests. Redis scheduling/retries, actual private storage, and Neon connectivity/migrations remain unverified. Recommend local verification now; recommend approving 021–024 for the existing Neon database only after that verification passes and the target migration ledger/data review is satisfactory.

## External configuration and known MVP limits

Resume storage is the remaining external dependency. Select a private object-storage provider and supply its bucket/container, endpoint/region if required, and least-privilege credentials through secure configuration. Then implement the existing `ResumeStorage` interface (`put`, `get`, `delete`) in the configured adapter. No real upload is attempted. Valid candidate upload/download/delete requests return 503 until then. Employer downloads first check application membership and unresolved status; resolved application resumes return 404 even with storage unconfigured. The test-only in-memory adapter is never used by production routes. PDF checks validate MIME, magic bytes, EOF marker, filename, and size; they do not provide malware scanning or AI parsing. Storage cleanup is best effort after committed replacement/deletion; ambiguous commits retain the new object rather than risking deletion of a committed resume.

Other intentional limits: 15-minute JWTs require re-login, one current resume without application snapshots, exact duplicate detection rather than fuzzy matching, fully structured drafts, existing date/time input semantics, one platform timezone, no invitations/member removal/ownership transfer, and no automatic account suspension. No frontend work is included.

Next step: run local checks with a compatible Node runtime, select resume storage, and review/approve migrations before any Neon execution. Backend deployment readiness is pending those steps.

## Files changed in the correction pass

24 files; other existing worktree changes belong to the earlier implementation.

### API/config

- [apps/api/package.json](../apps/api/package.json)
- [apps/api/src/app.ts](../apps/api/src/app.ts)
- [apps/api/src/middleware/error.middleware.ts](../apps/api/src/middleware/error.middleware.ts)
- [apps/api/src/modules/application/application.service.ts](../apps/api/src/modules/application/application.service.ts)
- [apps/api/src/modules/application/application-privacy.ts](../apps/api/src/modules/application/application-privacy.ts)
- [apps/api/src/modules/candidate/candidate.controller.ts](../apps/api/src/modules/candidate/candidate.controller.ts)
- [apps/api/src/modules/candidate/candidate.routes.ts](../apps/api/src/modules/candidate/candidate.routes.ts)
- [apps/api/src/modules/candidate/candidate.service.ts](../apps/api/src/modules/candidate/candidate.service.ts)
- [apps/api/src/modules/company/company.controller.ts](../apps/api/src/modules/company/company.controller.ts)
- [apps/api/src/modules/company/company.routes.ts](../apps/api/src/modules/company/company.routes.ts)
- [apps/api/src/modules/job/employer-job.routes.ts](../apps/api/src/modules/job/employer-job.routes.ts)
- [apps/api/src/modules/job/job.service.ts](../apps/api/src/modules/job/job.service.ts)
- [apps/api/src/modules/job/job-accountability.service.ts](../apps/api/src/modules/job/job-accountability.service.ts)
- [apps/api/src/modules/resume/resume.controller.ts](../apps/api/src/modules/resume/resume.controller.ts)
- [apps/api/src/modules/resume/resume.service.ts](../apps/api/src/modules/resume/resume.service.ts)

### Worker

- [apps/worker/src/jobs/mark-missed-decision-deadlines.job.ts](../apps/worker/src/jobs/mark-missed-decision-deadlines.job.ts)

### Tests

- [apps/api/tests/integration/backend.test.ts](../apps/api/tests/integration/backend.test.ts)
- [apps/api/tests/integration/migrations.test.ts](../apps/api/tests/integration/migrations.test.ts)
- [apps/api/tests/local-test-database.test.ts](../apps/api/tests/local-test-database.test.ts)
- [apps/api/tests/parser-errors.test.ts](../apps/api/tests/parser-errors.test.ts)
- [apps/api/tests/helpers/local-test-database.ts](../apps/api/tests/helpers/local-test-database.ts)

### Documentation

- [README.md](../README.md)
- [docs/backend-api.md](backend-api.md)
- [docs/backend-implementation.md](backend-implementation.md)

## Exact source test inventory (not executed here)

### Unit

`apps/api/tests/job-schema.test.ts`

- title-only PATCH preserves all omitted relationships
- empty and unknown-only PATCH bodies are rejected
- explicit empty preferred skills and benefits are preserved as replacements

`apps/api/tests/local-test-database.test.ts`

- integration database guard accepts only explicit loopback test databases
- integration database guard rejects remote, overridden, and ambiguous connections

`apps/api/tests/parser-errors.test.ts`

- known parser failures use client statuses and stable message responses
- unrelated server errors cannot impersonate parser client statuses

`apps/api/tests/validation.test.ts`

- password validation uses UTF-8 bytes
- employer filters accept every outcome but mutation cannot impersonate candidate/cancellation
- profiles preserve omitted skills and reject duplicates
- resume validation rejects paths, spoofed types, empty and oversized uploads
- duplicate hashing normalizes text, sorts canonical IDs and ignores hiring-cycle dates

### PostgreSQL integration

`apps/api/tests/integration/backend.test.ts`

- fresh bootstrap and repeated migration runs
- duplicate registration is a business conflict even under concurrency
- PATCH preserves omitted relationships and invalid references roll back
- authorization and duplicate application guards
- HTTP authorization, validation, and pagination contracts
- terminal outcomes cannot be withdrawn or offer responses rewritten
- concurrent offers obey capacity and opening edits respect occupied slots
- manual closure metadata, fill requirements, and historical access
- cancellation preserves history, cancels interviews, and blocks accepted offers
- interview cannot be rescheduled after leaving interview stage
- worker jobs are idempotent and pending offers remain unresolved
- overdue deadline extended before worker scan records the original deadline
- deadline edits preserve an existing marker and do not invent an unmissed deadline
- late resolution and cancellation capture missed deadlines before worker recovery
- terminal jobs reject deadline edits and worker scans leave their marker unchanged
- profiles, saved jobs, company roles, and notification ownership
- duplicate active postings are rejected, terminal history allows repost
- identical jobs in different companies are allowed
- published content collisions roll back and valid edits refresh content_hash
- repost lineage does not bypass active duplicate protection
- opening reduction versus concurrent offer preserves capacity
- cancellation versus offer acceptance has one consistent outcome
- fill versus cancellation preserves accepted applications
- concurrent duplicate applications create a single application
- concurrent identical publishes are serialized
- resume ownership boundary and single active PDF replacement

`apps/api/tests/integration/migrations.test.ts`

- legacy 001–020 upgrades without rerunning 013 and preserves existing data
- legacy checksum baseline records current file hashes once and repeated runs are idempotent
- checksum mismatch rejects modified historical SQL without changing data or ledger
