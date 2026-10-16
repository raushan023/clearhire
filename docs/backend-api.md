# Backend API additions and changes

All paths below require a Bearer access token. Candidate paths require candidate role; employer paths require employer role. Request/response field names are camelCase. Existing job/application/auth routes remain.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/candidate/profile` | Own profile, or `{ profile: null }` before creation |
| PATCH | `/api/candidate/profile` | Create/update own profile; returns `{ profile }` |
| GET | `/api/candidate/saved-jobs?page=1&limit=20` | Own saved jobs with current job status and pagination |
| PUT | `/api/candidate/saved-jobs/:jobId` | Idempotent save of an open job; 204 |
| DELETE | `/api/candidate/saved-jobs/:jobId` | Idempotent unsave; 204 |
| GET | `/api/candidate/resume` | Own active resume metadata or null; no storage key |
| PUT | `/api/candidate/resume` | Replace active resume with raw `application/pdf` bytes; optional `X-File-Name: resume.pdf` |
| GET | `/api/candidate/resume/download` | Private PDF download |
| DELETE | `/api/candidate/resume` | Remove active resume; 204 |
| GET | `/api/companies` | Companies current employer belongs to, including membership role |
| GET | `/api/companies/:companyId` | Company details for members |
| PATCH | `/api/companies/:companyId` | Owner-only name/website/description update |
| GET | `/api/companies/:companyId/members` | Member listing for current members |
| POST | `/api/companies/:companyId/members` | Owner adds an existing employer as recruiter using `{ userId }` |
| GET | `/api/employer/applications/:applicationId` | Company-authorized history and candidate basics; current profile/resume only while unresolved |
| GET | `/api/employer/applications/:applicationId/resume` | Current active resume through an unresolved, company-authorized application; resolved applications return 404 |
| GET | `/api/notifications?page=1&limit=20` | `{ notifications, pagination: { page, limit, total, totalPages } }` |

Profile PATCH fields: `headline`, `summary`, `totalExperience`, `city`, `state`, `country`, `currentCompany`, `currentTitle`, `skillIds`. Text fields may be null to clear; skills use canonical UUIDs. Omitted fields remain unchanged; `skillIds: []` clears skills. Experience uses tenths of years. Empty PATCH bodies are rejected.

Company create remains `POST /api/companies`. Recruiters may manage recruitment workflows using membership but cannot edit the company or add other members. Invitation, removal, ownership-transfer, and email delivery workflows are outside this MVP.

Resume uploads accept only PDF, up to 5 MiB, with MIME/signature and filename validation. They are raw bytes, not multipart or base64 JSON. Storage keys never appear in external responses and PDF responses are attachments with `no-store` and `nosniff`. Missing storage configuration produces 503. Employer downloads check company membership and unresolved application status before looking up the candidate's current resume. Live data is available only for `applied`, `under_review`, `shortlisted`, `interview`, `final_review`, and `offer`. For all resolved outcomes (`withdrawn`, `rejected`, `offer_declined`, `offer_accepted`, `job_cancelled`), employer detail retains candidate basics, application history, timeline, and interviews but returns `candidate.profile: null` and `resume: null`; the application resume download returns 404. Access/status checks stay locked through the read so concurrent resolution cannot authorize a later read. The one active resume belongs to the candidate. An unresolved application sees its current replacement, not necessarily the file present when applying: immutable per-application resume/profile snapshots are outside this MVP. Previously downloaded data cannot be revoked.

Changed existing behavior:

- Registration returns camelCase user fields; duplicate email conflicts map to 409 for both email indexes. Passwords are limited to 72 UTF-8 bytes.
- Job PATCH preserves omitted required/preferred skills and benefits. Explicit relationships replace those lists. Invalid canonical IDs produce 400; duplicate active jobs and capacity conflicts produce 409.
- Job detail includes `applicationsClosedAt`, `applicationsClosedBy`, `cancelledAt`, `cancellationReason`, `parentJobId`, `changeHistory`, `statusHistory`, and `accountability`. Internal actor IDs are not exposed.
- Open-job access follows existing authenticated rules. For non-open, non-draft jobs, an employer needs company membership, and a candidate must have applied or saved the job. Drafts remain employer-only.
- Employer application filtering supports all eleven application statuses. Only job cancellation generates `job_cancelled`; normal employer transition APIs cannot set it or candidate offer responses.
- Candidate withdrawal preserves the existing prohibition during pending `offer`, and now rejects every final outcome.
- Interview rescheduling requires both a scheduled interview and application status `interview`. Cancelling an interview does not change the application stage.
- Job cancellation cancels scheduled interviews of affected active applications, writes notifications and histories in one transaction, and preserves resolved applications.
- Unread notification count still counts every unread notification, independently of pagination.

## Correction-pass contracts

Each route has an explicit controller action. A trailing slash selects the same action, including company member listing and resume download. HEAD uses the GET route's authorization/status/headers with no response body; there are no method/path dispatch branches or custom HEAD handlers.

Errors retain `{ message }`, with field validation optionally including `errors`. Conventions are 400 invalid input, 401 missing/invalid authentication, 403 an authenticated permission failure when disclosure is acceptable, 404 missing or deliberately concealed data, and 409 a request conflicting with current business state. Candidate application/notification ownership and hidden job reads remain 404; existing employer company/application membership denials remain 403. Saving a missing/draft job returns 404, saving a previously unsaved non-open job returns 409, and an already-saved non-draft job remains an idempotent 204 even after closure. Applying to a closed job remains 409. No private candidate data is returned by save conflicts. Parser failures return 400 for malformed JSON, 413 for excessive body size, and 415 for unsupported charset/content encoding. Unrelated server errors remain 500; storage unavailable remains 503.

`PATCH /api/jobs/:jobId` still returns `{ message, job }` with a flat camelCase job object: `id`, `companyId`, `title`, `description`, `employmentType`, `workMode`, `city`, `state`, `country`, `experienceMin`, `experienceMax`, `salaryMin`, `salaryMax`, `salaryCurrency`, `salaryPeriod`, `openings`, `status`, `applicationDeadline`, `decisionDeadline`, `createdAt`, `updatedAt`. It does not adopt the GET detail's nested relationships/accountability/history. Profile, resume metadata, company/member, saved-job, and employer-detail responses use curated camelCase fields; storage keys and raw database rows are not response contracts.

Deadline accountability applies to `open`, `applications_closed`, and `hiring_in_progress` jobs with at least one unresolved application. The worker and authorized mutations record a missing marker using the deadline that was crossed. The API captures this from the pre-change state within the same SQL statement that overwrites a deadline, changes job status/cancels, or changes/resolves an application; the parent job lock serializes these operations. Existing markers never change. Future deadlines, drafts, terminal jobs, and jobs with no unresolved applications do not create a new marker. Terminal edits are rejected. Later extensions/resolution retain the historical marker. The 24/72-hour warning thresholds use that marker, so worker recovery can find multiple warning stages already due. Existing markers from earlier worker versions retain their original timestamp.
