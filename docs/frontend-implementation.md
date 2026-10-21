# ClearHire frontend implementation

The existing empty `apps/web` workspace is now a React/TypeScript/Vite application. It communicates directly with Express. The initial frontend work preserved the backend; the subsequent focused account pass adds the shared current-user PATCH and migration 025 described below. Hiring business rules and `.env` secrets remain unchanged. Root changes register `dev:web`, update the dependency lock, and ignore local browser-test artifacts. No commit, push, database migration execution, or deployment was performed.

## Routes and completed flows

Public: `/login`, `/register`, and `/` (session-aware redirect).

Candidate:

- `/candidate`: application, interview-stage, pending-offer and saved-job counts; recent applications; upcoming decision commitments with actual job accountability. Interview-stage counts are not a count of scheduled interview appointments.
- `/candidate/jobs`: API search, country/city, employment/work mode, candidate experience, salary threshold, multiple canonical skills, and pagination. Filters persist in the URL. Mobile filters start collapsed.
- `/candidate/jobs/:jobId`: full role, salary, skills, benefits, company, lifecycle history, published changes, closure/cancellation metadata, repost reference, accountability, application confirmation, save/unsave, and existing-application access.
- `/candidate/saved-jobs`: paginated current/historical saved roles and unsave.
- `/candidate/applications`, `/candidate/applications/:applicationId`: statuses, timestamps, deadlines, complete timeline, scheduled/cancelled interview history, eligible withdrawal, and confirmed offer acceptance/decline.
- `/candidate/profile`: separate basic contact details and professional profile forms; canonical professional skills.
- `/candidate/resume`: current metadata, validated raw-PDF upload/replacement, download, and confirmed deletion. Storage errors explicitly render the environment’s unavailability and never claim success.
- `/candidate/notifications`: paginated backend messages and mark-as-read.

Employer:

- `/employer`: total postings, active count within the latest 20 postings (explicitly labelled), complete overdue-obligation count, company memberships, and recent applicant activity per posting. No unsupported full-market analytics are inferred.
- `/employer/companies`, `/employer/companies/:companyId`: company creation, details, owner-only edits, member listing, and owner addition of existing employers as recruiters. Employers can find their own ID to share with an owner; invitations/removal/transfer are not invented.
- `/employer/jobs`: company/status filters, pagination, applicants/openings, and deadlines.
- `/employer/jobs/new`, `/employer/jobs/:jobId/edit`: structured React Hook Form/Zod form, API-controlled skills/benefits, salary/experience ranges, openings, and deadline commitments. Editing requires company membership and an editable API status. Published changes are explained as visible history.
- `/employer/jobs/:jobId`: role, accountability, separate status/content histories, company-scoped management, confirmed publication, closure, hiring progression, fill, cancellation with reason, and repost to a new draft. Terminal jobs expose repost rather than reopening.
- `/employer/jobs/:jobId/applications`: all eleven application-status filters and paginated applicants.
- `/employer/applications/:applicationId`: authorized candidate basics, permitted profile/resume, timeline and interviews; employer-controlled progression/rejection/offer; schedule, reschedule and cancel interview. Only the candidate can answer an offer.
- `/employer/feedback-obligations`: unresolved overdue applications and links to review them. Actual warning stages remain in backend notifications; no account suspension is claimed.
- `/employer/notifications`: shared notification UI scoped to the authenticated employer.
- `/employer/profile`: personal account contact details, separate from company management.

Both workspace trees have authenticated role guards and an internal not-found route. A wrong-role deep link returns to the authenticated user’s own workspace. Missing or concealed API data renders the backend error rather than a fabricated record.

## Components and data flow

`src/lib/api-client.ts` owns the only raw `fetch`: base URL, JSON/raw bytes, Bearer headers, business messages, field errors, 204 handling, downloads, and 401 signalling. `src/lib/api.ts` maps typed methods to existing Express endpoints. No fetch calls are scattered through pages.

`src/lib/query.ts` scopes every server-state key to the current account: `['account', userId, resource, ...parameters]`. Mutations invalidate related resource families; permission/state conflicts also refresh relevant state. Company edits refresh job/company displays; job edits refresh application deadlines and obligations. Responses from flat job PATCH are never placed into the nested GET-detail cache. Queries receive abort signals. Error responses are not repeatedly retried as transient failures.

`src/lib/auth.tsx` owns only authentication state. Access tokens use per-tab sessionStorage, with a memory fallback if storage is disabled. They are not persisted to localStorage or URLs. `/auth/current-user` bootstraps identity and role from the server. Decoding `exp` only schedules a UX logout; JWT contents do not establish the user’s role. An API 401 clears invalid authentication, cancels queries, clears account caches, and presents a re-login message. Late 401s carrying another token do not clear a new session. Bootstrap failures offer retry/logout. Login preserves a requested path only within the authenticated role’s route tree. There is no refresh-token flow. Client logout removes this tab’s token; it does not revoke a JWT server-side.

Shared components include PageHeader, StatusBadge, Field, EmptyState, LoadingState, ErrorState, Feedback, Pagination, ConfirmDialog, SkillPicker, DeadlineDisplay, JobCard, ApplicationStatusTimeline, JobStatusTimeline, ChangeHistoryList, Interviews, ApplicationSummary, the role-aware Shell, and a top-level rendering error boundary. Page modules are lazy-loaded.

Native modal dialogs provide focus containment and Escape cancellation, with confirmations for irreversible outcomes. Fields have labels and associated error messages, focus is visible, a keyboard skip link is provided, route changes focus the main region without jumping to a lower scroll position, and wide tables scroll within the page. External links allow only HTTP(S) schemes.

## API integration findings

The initial frontend used the existing backend contracts. The later contact-details pass adds the shared account endpoint; other contracts remain:

- Registration returns a user, not an access token. The UI directs newly registered users to login.
- Bootstrap is `GET /api/auth/current-user`; no `/me`, refresh, logout or session endpoint was invented.
- Candidate applications are an unpaginated `{ applications }` response. Employer applicants, jobs, notifications and saved jobs have pagination.
- Candidate search rows omit status and nested accountability. Search SQL returns only open, future-intake jobs; the UI uses that contract and the actual deadline. Detail has full status/accountability.
- Experience search is `job.experience_min <= experienceMin`; salary search is `job.salary_max >= salaryMin`. Skill filters match all requested IDs across required/preferred job skills. The search picker is labelled matching skills accordingly. The API has no currency/period salary search filter; users must inspect each role’s currency/period.
- Job PATCH is flat, job GET is nested. Mutation results are invalidated/refetched rather than treated as a full detail object.
- There is no saved-status-by-job endpoint. The detail page reads existing saved-job pages to establish saved status; list pages remain paginated.
- Open-job editing requires a future application deadline in backend source. If intake has elapsed before the worker closes the job, the editor explains the requirement instead of changing the backend rule.
- Canonical skill search is limited by the API; the picker searches the backend instead of treating the initial 50 results as a complete catalogue.
- Resolved applications return null live profile/resume data. Employer UI preserves history and omits resume controls accordingly. It does not request application-time snapshots.
- Resume upload is raw `application/pdf`, not multipart. X-File-Name carries the validated filename. Storage 503 is a real backend limitation, not an invitation to simulate successful uploads.

## Time and action presentation

Datetime inputs explicitly use Asia/Kolkata (UTC+05:30) and serialize to UTC ISO timestamps. Display dates use one Intl helper in the viewer’s local timezone, whose name appears in the shell. Existing job deadline timestamps are preserved exactly if their form inputs are untouched, avoiding artificial audit entries caused by minute-level input formatting.

Action visibility mirrors available API actions only as a presentation aid. Capacity, authorization, duplicates, eligibility, transitions and race protection remain on the backend. State can change concurrently; 400/403/404/409 messages remain visible and related data is refreshed. No job status outside the backend’s six supported states was introduced.

## Tests and verification

`npm test --workspace=web` runs focused node:test cases for job/range/canonical-skill validation, deadlines/timezone conversion, cancellation/repost/interview forms, external links, action visibility, offer/withdrawal controls, employer transition restrictions, business-error rendering, storage 503 messaging, login return paths and invalid token-cache handling.

`npm run test:browser --workspace=web` runs Playwright/Chromium tests against a local Vite server with API responses intercepted by fixtures. Tests cover guest login/logout and return path, both role guards, 401 re-login, confirmed offer acceptance, publish conflict rendering, cancellation validation and terminal actions, invalid job forms, resume 503, every requested route, mobile overflow and Escape dialog behavior. Tests also capture local screenshots for visual review. These tests do not establish live backend/PostgreSQL/storage correctness. They do not use `.env` database credentials or run migrations.

Commands used during implementation include npm dependency installation, per-phase web typecheck/build and diff review, frontend unit tests, root `npm run check`, root `npm run build`, Chromium installation, and the browser suite. Final verification passed: root `npm run check` (all workspace typechecks, 15 API unit tests and 17 frontend unit/component tests), root `npm run build` (API, web and worker), 18 Playwright browser tests, and `git diff --check`. The web typecheck/build also passed at each implementation phase. Desktop/mobile screenshots were visually reviewed. These results do not include live PostgreSQL/API/storage smoke tests. The initial frontend browser run caught a real login-return-path race; it was corrected and covered by a regression test. Vite emits two harmless dependency-comment annotation warnings from the installed Zod package; the build succeeds and no bundle-size warning remains after code splitting.

## External setup and limits

- Run the existing Express API with its existing environment configuration. For local Vite development, `/api` proxies to port 4000. An explicitly configured `VITE_API_BASE_URL` must point to the Express `/api` base. Only public configuration belongs in Vite variables.
- Real accounts/data and a running API are needed for a final live integration smoke test. Browser fixture tests are intentionally not presented as that verification.
- Private resume storage is still a backend external dependency. No provider, credentials, storage adapter, or cloud upload was introduced by the frontend.
- Dashboard previews are composed from existing endpoints and labelled where bounded; there are no invented analytics endpoints or promises of live push updates. Server state refreshes on navigation/window focus and relevant mutations.
- sessionStorage is JavaScript-accessible and per-tab. Logout has the existing backend’s client-only semantics; no revocation or cross-device session management is claimed.
- Automated browser verification targets Chromium; other browsers and assistive technologies still need release-level manual review. Basic keyboard/labels/dialog checks and mobile screenshots are covered.
- Any future static host needs SPA route fallback and the intended API base/CORS configuration. No hosting, deployment, domain, or reverse-proxy changes were made.

## Focused account and request-feedback pass

Both role-specific profile routes use `ContactDetails`: current-user first/last name, email and optional phone; accessible labels/autocomplete, responsive columns, associated field errors, duplicate-email feedback and a separately saved professional profile. Dirty fields alone are sent to shared `PATCH /api/auth/current-user`. Pending contact fields are disabled. A synchronous mutation guard prevents duplicate requests before React paints. Success updates both auth state and the account-scoped current-user query cache. Failed values never enter either. A late response after logout or a different login cannot restore an old account.

Shared request UI provides spinner, skeleton, inline status and pending buttons. Confirmation actions provide operation-specific pending text. Lists retain distinct loading/error/empty/loaded branches. Pagination disables while fetching. Initial loading differs from background refresh: previously fetched data stays visible during a transient refresh failure with a nonblocking notice; 401/403/404 access failures still block private views. Normal data stale time is 30 seconds, catalogues five minutes, inactive query retention one minute. Logout clears query caches. Previous list data is limited to the same account and resource, and applicant lists additionally require the same job. Canonical sorted list query parameters let the employer dashboard share its first jobs page with the full list. Mutations invalidate affected resource families rather than the entire cache.

Major feature pages retain React.lazy imports; the new employer profile has its own lazy module. A Suspense boundary inside Shell keeps navigation visible while a page loads, using the shared loader. Shared JobDetails moved to a component module so employer job pages no longer import the candidate jobs page bundle. Pure application/status/history components use React.memo because query structural sharing preserves their array props while parent dialogs/forms change. Job cards derive a status from the clock and are intentionally not memoized; bounded table rows, trivial badges, and inline callbacks were left alone. No blanket useMemo/useCallback was added. Effect dependencies and role/account boundaries were reviewed; route/browser tests cover lazy loading and guards.

New frontend unit/component tests cover loader semantics, pending controls, contact validation and account/job-safe pagination placeholders. Browser coverage adds both role contact forms, populated fields, pending/duplicate saves, immediate auth-name updates, phone clearing, duplicate-email rejection without auth changes, initial list loading before empty state, deferred route Suspense and nonblocking failed background refresh. Backend schema and isolated PostgreSQL HTTP tests cover PATCH validation, both roles, ownership, partial updates, phone read/update/clear and concurrent email conflicts. The legacy migration upgrade test now expects the new nullable phone while preserving all previous values.

Database-backed tests require an explicit loopback PostgreSQL `TEST_DATABASE_URL` whose database name ends in `_test`; they never fall back to the development/Neon URL. Browser tests intercept API requests and do not verify a live database. Migration 025 is pending and must be run explicitly before the updated API starts. No deployment, commit, push or secret change is included. The two manual development servers remain stopped after this pass; Playwright owns and stops its temporary Vite server.

Final focused-pass verification: root check (15 API + 17 frontend unit tests), root build, and 18 Chromium browser tests passed. The two PostgreSQL integration suites skipped because TEST_DATABASE_URL was not configured; their HTTP/concurrency/migration checks remain unverified. Builds retain the two existing Zod comment-annotation warnings. Mobile candidate/employer contact screenshots were visually reviewed, and browser checks cover both 390px and 768px viewports.

Before using the updated API locally, run the isolated integration tests with your own local `_test` database connection, review the source SQL plan, then explicitly apply pending migrations to your intended development database:

```sh
TEST_DATABASE_URL='postgresql://localhost/clearhire_test' npm run test:integration
npm run db:plan --workspace=api
npm run db:migrate --workspace=api
```

Adjust the test URL for your local PostgreSQL credentials; it must remain a loopback test database. `db:plan` prints source SQL without connecting to a database. `db:migrate` uses the existing direct DATABASE_URL and applies all pending migrations, including 025; it is a database write and has not been run here. When ready for manual testing, start `npm run dev:api` and `npm run dev:web` in separate terminals.
