# ClearHire Product Requirements

## Product

ClearHire is a transparent job marketplace connecting employers and job seekers.

It is not a social network.

ClearHire is intentionally focused on deterministic recruitment workflows, clear hiring stages, deadlines, candidate feedback, audit history, and employer accountability.

## User Roles

ClearHire has two primary user roles:

1. Candidate
2. Employer

Employers may belong to one or more companies. Company membership may include roles such as owner or recruiter.

## Product Principles

ClearHire should remain simple and focused exclusively on recruitment.

The platform must not contain:

- Social posts
- Likes
- Comments
- Shares
- Followers
- Connections
- Social feeds
- AI features
- AI candidate matching
- AI resume scoring
- AI-generated job descriptions
- LLM-based recruitment decisions

Important recruitment rules must be deterministic and explainable.

Business-critical rules must be enforced by the backend and database where appropriate. The frontend must never be the only layer enforcing an important business rule.

## Core Candidate Experience

Candidates should be able to:

- Register and log in
- Create and manage their candidate profile
- Upload a resume
- Search and filter active jobs
- View complete job details
- Save jobs
- Apply for jobs
- View all their applications
- Track the current status of each application
- View the complete application timeline
- View job lifecycle history
- View meaningful changes made to a published job
- Receive in-app notifications when application status changes
- Receive interview scheduling, rescheduling, and cancellation notifications
- Accept or decline an offer
- Withdraw an active application
- See when an employer has missed the stated decision deadline
- See whether candidates are still awaiting an outcome for an overdue job
- See when and why a job they applied to was cancelled

## Core Employer Experience

Employers should be able to:

- Register and log in
- Create and manage companies
- Belong to multiple companies
- Create structured job postings
- Maintain jobs as drafts before publishing
- Publish complete jobs
- Edit published jobs while preserving candidate-visible change history
- View active and historical jobs
- View applicants
- Move applicants through defined hiring stages
- Reject candidates
- Make offers
- Schedule, reschedule, and cancel interviews
- Close applications manually
- Move jobs into hiring-in-progress
- Mark jobs as filled only when hiring requirements are actually satisfied
- Cancel jobs with a recorded reason
- Repost eligible terminal jobs as new job postings
- Receive overdue-feedback reminders and escalation warnings

## Job Transparency Requirements

Every published job must include:

- Job title
- Company
- Job description
- Employment type
- Work mode
- Location
- Minimum experience
- Maximum experience
- At least one required skill
- Salary minimum
- Salary maximum
- Salary currency
- Salary period
- Application deadline
- Expected decision deadline
- Number of openings

Salary cannot be replaced with terms such as "competitive" or "as per industry standards".

Application and decision deadlines are mandatory.

The decision deadline must be later than the application deadline.

Employers may edit a published job, but meaningful changes must be recorded and shown in candidate-visible change history.

Meaningful published changes include:

- Title
- Description
- Employment type
- Work mode
- Location
- Experience range
- Salary range
- Number of openings
- Application deadline
- Decision deadline
- Required skills
- Preferred skills
- Benefits

Draft edits do not require candidate-facing change history.

## Job Lifecycle

A job follows:

DRAFT → OPEN → APPLICATIONS_CLOSED → HIRING_IN_PROGRESS → FILLED

CANCELLED is a separate terminal state.

There is no EXPIRED job status.

### Job Status Meaning

- `DRAFT` — employer is preparing the posting.
- `OPEN` — the job is accepting applications.
- `APPLICATIONS_CLOSED` — no further applications are accepted.
- `HIRING_IN_PROGRESS` — the employer has explicitly confirmed that evaluation/hiring is underway.
- `FILLED` — all openings have accepted offers and no unresolved applications remain.
- `CANCELLED` — the hiring requirement was withdrawn before completion.

When the application deadline passes, an `OPEN` job automatically moves to `APPLICATIONS_CLOSED`.

The system records:

- `applications_closed_at`
- `applications_closed_by` as `employer` or `system`

Automatic deadline closure does not use a separate expired state.

Closed application intake does not automatically mean hiring is in progress. The employer must explicitly move the job from `APPLICATIONS_CLOSED` to `HIRING_IN_PROGRESS`.

Terminal jobs cannot be reopened.

If an employer needs the same position again, a new job must be created as a repost.

Reposting:

- Is allowed from `FILLED` or `CANCELLED`
- Creates a new `DRAFT` job
- Copies job content
- Copies skills
- Copies benefits
- Requires new application and decision deadlines
- Links to the previous job through `parent_job_id`
- Does not copy applications, application events, job status events, or published-change history

## Job Status History

Job lifecycle changes are stored separately from job-content changes.

`changeHistory` represents changes to the contents of a published job.

`statusHistory` represents movement through the hiring lifecycle.

Examples of status history:

- DRAFT → OPEN
- OPEN → APPLICATIONS_CLOSED
- APPLICATIONS_CLOSED → HIRING_IN_PROGRESS
- HIRING_IN_PROGRESS → FILLED
- OPEN → CANCELLED

Status events should record:

- Job
- Previous status
- New status
- Source (`employer` or `system`)
- Actor when applicable
- Optional note
- Timestamp

System-generated transitions use no employer actor.

Publishing, manual lifecycle transitions, automatic application closure, and cancellation should record status events atomically with the corresponding job update.

## Application Lifecycle

An application follows the normal progression:

APPLIED → UNDER_REVIEW → SHORTLISTED → INTERVIEW → FINAL_REVIEW → OFFER

From `OFFER`, only the candidate may choose:

- `OFFER_ACCEPTED`
- `OFFER_DECLINED`

An application may move to `REJECTED` where permitted by the employer workflow.

A candidate may move an eligible active application to `WITHDRAWN`.

When a job itself is cancelled, affected active applications move to `JOB_CANCELLED`.

`JOB_CANCELLED` is intentionally different from `REJECTED`: the candidate was not rejected; the position was withdrawn.

Every application status change must be recorded as a separate historical event.

Candidates must be able to see the application timeline, but internal actor identifiers do not need to be exposed in the candidate-facing response.

### Employer-Controlled Application Transitions

- `APPLIED` → `UNDER_REVIEW` or `REJECTED`
- `UNDER_REVIEW` → `SHORTLISTED` or `REJECTED`
- `SHORTLISTED` → `INTERVIEW` or `REJECTED`
- `INTERVIEW` → `FINAL_REVIEW` or `REJECTED`
- `FINAL_REVIEW` → `OFFER` or `REJECTED`

Employers cannot mark an application as `OFFER_ACCEPTED` or `OFFER_DECLINED`.

### Terminal / Resolved Application Outcomes

The following are final resolved outcomes:

- `OFFER_ACCEPTED`
- `OFFER_DECLINED`
- `REJECTED`
- `WITHDRAWN`
- `JOB_CANCELLED`

`OFFER` itself is not a final outcome because the candidate has not yet responded.

## Application Rules

A candidate may apply only when:

- The job exists
- The job status is `OPEN`
- The application deadline has not passed

A candidate may apply only once per job.

Candidates may withdraw eligible active applications.

Terminal applications cannot be withdrawn.

## Openings and Offers

The number of job openings must be respected throughout the offer and fill process.

Before another candidate can be moved to `OFFER`, the total number of applications currently in:

- `OFFER`
- `OFFER_ACCEPTED`

must be less than the number of job openings.

A job may move to `FILLED` only when:

1. No unresolved applications remain.
2. The number of `OFFER_ACCEPTED` applications is at least equal to the number of openings.

Sending an offer is not enough to consider a position filled.

## Interviews

Interview scheduling is part of the application workflow.

An application must be in the `INTERVIEW` stage before an interview can be scheduled.

Multiple interview records may exist for the same application to support multiple rounds.

Interview data may include:

- Scheduled date/time
- Mode
- Meeting link
- Location
- Notes/instructions
- Status
- Scheduled by
- Cancellation metadata
- Created and updated timestamps

Supported interview modes:

- Video
- Phone
- Onsite

Rules:

- Video interviews require a meeting link.
- Onsite interviews require a location.
- New interview times must be in the future.
- Interviews may be rescheduled.
- Interviews may be cancelled.
- Cancelled interview records must be preserved rather than deleted.
- Cancelling an interview does not automatically reject the application or move it out of the interview stage.

Candidates should receive notifications when interviews are scheduled, rescheduled, or cancelled.

## Job Cancellation

A job may be cancelled from:

- `OPEN`
- `APPLICATIONS_CLOSED`
- `HIRING_IN_PROGRESS`

Cancellation requires a meaningful reason.

Cancellation records should include:

- `cancelled_at`
- `cancelled_by`
- `cancellation_reason`

A job with an already accepted offer cannot be cancelled through the normal cancellation flow.

When a job is cancelled:

- The job moves to `CANCELLED`
- Eligible active applications move to `JOB_CANCELLED`
- Application events are recorded
- Candidate notifications are created
- A job status event is recorded

Already resolved applications such as `REJECTED`, `WITHDRAWN`, and `OFFER_DECLINED` remain unchanged.

The cancellation operation should be transactional.

## Deadlines and Accountability

ClearHire treats deadlines as product commitments, not optional display fields.

### Application Deadline

When an application deadline passes:

OPEN → APPLICATIONS_CLOSED

This happens automatically through the worker.

### Decision Deadline

When the decision deadline passes without the hiring process being fully resolved:

- `decision_deadline_missed_at` is recorded once
- The historical missed-deadline fact remains visible even if the deadline is edited later
- Candidates can see that the stated decision deadline was missed
- Employers receive feedback-obligation warnings

A job detail response should be able to expose an accountability summary such as:

```json
{
  "accountability": {
    "decisionDeadlineMissed": true,
    "decisionDeadlineMissedAt": "timestamp",
    "candidatesAwaitingOutcome": 3
  }
}
```

Applications still considered unresolved for accountability purposes are:

- `APPLIED`
- `UNDER_REVIEW`
- `SHORTLISTED`
- `INTERVIEW`
- `FINAL_REVIEW`
- `OFFER`

Resolved outcomes are:

- `OFFER_ACCEPTED`
- `OFFER_DECLINED`
- `REJECTED`
- `WITHDRAWN`
- `JOB_CANCELLED`

A missed decision deadline remains part of the historical record even after all candidates eventually receive an outcome.

## Employer Feedback Obligations

Employers must provide outcomes for unresolved candidates.

ClearHire should identify overdue feedback obligations when:

- The job decision deadline has been missed, and
- One or more applications remain unresolved

The platform should use staged deterministic warnings rather than immediately suspending an employer.

Current escalation model:

1. Initial overdue warning
2. 24-hour unresolved warning
3. 72-hour final compliance warning

Notification types:

- `feedback_overdue`
- `feedback_overdue_24h`
- `feedback_overdue_72h`

The same employer/job/stage warning must not be created repeatedly.

Warnings should stop escalating once all affected applications are resolved.

Existing warnings remain in notification history because they represent events that actually occurred.

Automatic account suspension is not part of the current MVP.

A 72-hour warning may state that continued non-compliance may result in future account restrictions, but ClearHire must not claim that a restriction has occurred unless a separate compliance/restriction model is implemented.

## Notifications

ClearHire supports in-app notifications.

Notification data should include:

- Recipient user
- Type
- Title
- Message
- Optional job reference
- Optional application reference
- Read timestamp
- Created timestamp

Users should be able to:

- View their notifications
- Mark a notification as read
- View unread notification count

Users may access only their own notifications.

Candidate notification examples include:

- Application status changed
- Interview scheduled
- Interview rescheduled
- Interview cancelled
- Job cancelled

Employer notification examples include:

- Candidate accepted an offer
- Candidate declined an offer
- Initial feedback overdue warning
- 24-hour feedback overdue warning
- 72-hour feedback compliance warning

Normal application-status notifications may occur multiple times and should not be globally deduplicated.

Compliance reminders should be deduplicated by user, job, and escalation stage.

## Worker and Scheduled Jobs

ClearHire uses BullMQ and Redis for scheduled background processing.

Current platform timezone is:

`Asia/Kolkata`

Current intended daily schedule:

- `00:05` — automatically close application intake for jobs whose application deadline has passed
- `00:10` — mark missed decision deadlines
- `00:15` — create initial feedback-overdue reminders
- `00:20` — create feedback escalation reminders

Worker jobs must be idempotent.

The current single-timezone MVP does not require minute-by-minute deadline polling.

Future global timezone support may store exact UTC timestamps derived from the employer's local deadline/timezone, but that is outside the current MVP unless separately specified.

## Candidate-Facing Transparency

Candidates should be able to distinguish:

- Job content changes (`changeHistory`)
- Job lifecycle changes (`statusHistory`)
- Application lifecycle (`application timeline`)
- Application-closure source (`system` or `employer`)
- Missed decision deadline
- Current number of unresolved candidates where appropriate
- Job cancellation reason
- Reposted-job lineage where appropriate

Internal actor identifiers do not need to be exposed to candidates.

## Duplicate Job Protection

ClearHire should detect duplicate active job postings using deterministic techniques rather than AI.

The intended design may use:

- Content hashing such as SHA-256
- PostgreSQL similarity features such as `pg_trgm`

Duplicate protection must not depend on embeddings or LLMs.

## Engineering Principles

Business rules must be enforced by the backend and database where appropriate.

The frontend must never be the only layer enforcing an important business rule.

Controllers should remain thin:

- Validate the request
- Call the service layer
- Map known business errors to appropriate HTTP responses

Services should:

- Enforce business rules
- Perform database operations
- Own transactions where multiple writes form one business operation

Important multi-write business operations should be atomic.

Applied database migrations must never be modified. New schema changes require new numbered migrations.

Worker jobs must be safe to run repeatedly.

Authorization must ensure:

- Candidates cannot access another candidate's private application data
- Employers cannot access jobs/applications belonging to companies they do not belong to
- Notifications are visible only to their intended user

ClearHire should prefer straightforward, deterministic engineering over unnecessary abstraction.
