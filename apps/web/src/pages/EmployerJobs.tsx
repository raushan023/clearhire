import {
  InlineLoader,
  PendingButton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Feedback,
  Field,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
  label,
} from "../components/ui";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApiMutation, useApiQuery } from "../lib/query";
import { cancellationSchema, repostSchema } from "../lib/forms";
import {
  dateTime,
  jobActions,
  jobStatuses,
  platformIso,
  urlPage,
  viewerTimezone,
} from "../lib/presentation";
import {
  ChangeHistoryList,
  DeadlineDisplay,
  JobStatusTimeline,
} from "../components/Recruitment";
import { JobDescription, JobAccountability } from "../components/JobDetails";
import type { Job } from "../lib/types";
export function EmployerJobsPage() {
  const [params, setParams] = useSearchParams();
  const page = urlPage(params),
    queryParams = new URLSearchParams(params);
  queryParams.set("page", String(page));
  queryParams.set("limit", "20");
  queryParams.sort();
  const jobs = useApiQuery(
    ["employer-jobs", queryParams.toString()],
    (signal) => api.employerJobs(queryParams, signal),
  );
  const companies = useApiQuery(["companies"], api.companies);
  return (
    <>
      <PageHeader
        title="Your job postings"
        description="From first draft to a clear hiring outcome."
        actions={
          <Link className="button" to="/employer/jobs/new">
            Create job +
          </Link>
        }
      />
      <form
        className="panel filter-bar"
        key={params.toString()}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const [key, value] of data)
            if (value) next.set(key, String(value));
          setParams(next);
        }}
      >
        <Field label="Company">
          <select name="companyId" defaultValue={params.get("companyId") ?? ""}>
            <option value="">All your companies</option>
            {companies.data?.companies.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job status">
          <select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">All statuses</option>
            {jobStatuses.map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </Field>
        <PendingButton pending={jobs.isFetching} pendingText="Filtering…">
          Filter jobs
        </PendingButton>
        <button
          type="button"
          className="secondary"
          onClick={() => setParams({})}
        >
          Reset
        </button>
      </form>
      {companies.isPending && <InlineLoader text="Loading company filters…" />}
      {companies.error && (
        <ErrorState
          error={companies.error}
          retry={() => void companies.refetch()}
        />
      )}
      {jobs.isPending ? (
        <LoadingState />
      ) : jobs.error ? (
        <ErrorState error={jobs.error} retry={() => void jobs.refetch()} />
      ) : (
        <>
          {jobs.data.jobs.length ? (
            <div className="panel table-wrap">
              <table>
                <caption className="sr-only">Employer job postings</caption>
                <thead>
                  <tr>
                    <th>Role / company</th>
                    <th>Status</th>
                    <th>Applicants / openings</th>
                    <th>Deadlines</th>
                    <th>Hiring</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.data.jobs.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <Link to={`/employer/jobs/${j.id}`}>{j.title}</Link>
                        <span className="table-sub">{j.company.name}</span>
                      </td>
                      <td>
                        <StatusBadge status={j.status} />
                        {j.decisionDeadlineMissedAt && (
                          <p className="overdue small">
                            Decision deadline missed
                          </p>
                        )}
                      </td>
                      <td>
                        {j.applicationCount} applicant(s)
                        <span className="table-sub">
                          {j.openings} opening(s)
                        </span>
                      </td>
                      <td>
                        Apply: {dateTime(j.applicationDeadline)}
                        <span className="table-sub">
                          Decision: {dateTime(j.decisionDeadline)}
                        </span>
                      </td>
                      <td>
                        <Link to={`/employer/jobs/${j.id}/applications`}>
                          Applicants →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No postings in this view">
              Create a draft or adjust your filters.
            </EmptyState>
          )}
          <Pagination
            pending={jobs.isFetching}
            info={jobs.data.pagination}
            onPage={(page) => {
              const next = new URLSearchParams(params);
              next.set("page", String(page));
              setParams(next);
            }}
          />
        </>
      )}
    </>
  );
}
export function EmployerJobPage() {
  const { jobId = "" } = useParams();
  const query = useApiQuery(["job", jobId], (signal) => api.job(jobId, signal));
  const companies = useApiQuery(["companies"], api.companies);
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const job = query.data.job,
    member = companies.data?.companies.some(
      (company) => company.id === job.company.id,
    );
  return (
    <>
      <PageHeader
        title={job.title}
        description={job.company.name}
        actions={
          member ? (
            <Link
              className="button secondary"
              to={`/employer/jobs/${jobId}/applications`}
            >
              View applicants
            </Link>
          ) : undefined
        }
      />
      <div className="grid-two">
        <div>
          <JobDescription job={job} />
          <JobStatusTimeline events={job.statusHistory} />
          <ChangeHistoryList events={job.changeHistory} />
        </div>
        <aside>
          {companies.isPending ? (
            <LoadingState />
          ) : companies.error ? (
            <ErrorState
              error={companies.error}
              retry={() => void companies.refetch()}
            />
          ) : member ? (
            <JobActions job={job} />
          ) : (
            <p className="notice">
              Company membership is required to manage this job.
            </p>
          )}
          <section className="panel stack">
            <DeadlineDisplay
              label="Application deadline"
              value={job.applicationDeadline}
            />
            <DeadlineDisplay
              label="Decision deadline"
              value={job.decisionDeadline}
              missed={job.accountability.decisionDeadlineMissed}
            />
            <p className="small muted">Times in {viewerTimezone()}</p>
          </section>
          <JobAccountability job={job} />
        </aside>
      </div>
    </>
  );
}
function JobActions({ job }: { job: Job }) {
  const [action, setAction] = useState<string | null>(null),
    navigate = useNavigate();
  const cancel = useForm<z.infer<typeof cancellationSchema>>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: { reason: "" },
  });
  const repost = useForm<z.infer<typeof repostSchema>>({
    resolver: zodResolver(repostSchema),
    defaultValues: { applicationDeadline: "", decisionDeadline: "" },
  });
  const mutation = useApiMutation(
    async (selected: string) => {
      if (selected === "publish") {
        await api.publish(job.id);
        return undefined;
      }
      if (selected === "cancel") {
        await api.cancelJob(job.id, cancel.getValues("reason"));
        return undefined;
      }
      if (selected === "repost") {
        const values = repost.getValues();
        return api.repost(job.id, {
          applicationDeadline: platformIso(values.applicationDeadline),
          decisionDeadline: platformIso(values.decisionDeadline),
        });
      }
      await api.jobStatus(job.id, selected);
      return undefined;
    },
    [
      "employer-jobs",
      "job",
      "applicants",
      "application",
      "obligations",
      "notifications",
      "unread",
    ],
  );
  const names: Record<string, string> = {
    edit: "Edit job",
    publish: "Publish job",
    applications_closed: "Close applications",
    hiring_in_progress: "Start hiring",
    filled: "Mark filled",
    cancel: "Cancel job",
    repost: "Repost as new draft",
  };
  function perform() {
    if (action)
      mutation.mutate(action, {
        onSuccess: (result) => {
          setAction(null);
          if (result) navigate(`/employer/jobs/${result.job.id}`);
        },
      });
  }
  return (
    <section className="panel">
      <h2>Manage this job</h2>
      <div className="action-stack">
        {jobActions(job.status).map((next) =>
          next === "edit" ? (
            <Link
              key={next}
              className="button secondary"
              to={`/employer/jobs/${job.id}/edit`}
            >
              {names[next]}
            </Link>
          ) : (
            <PendingButton
              key={next}
              className={next === "cancel" ? "secondary" : ""}
              disabled={mutation.isPending}
              pending={mutation.isPending}
              pendingText="Saving…"
              onClick={() => {
                mutation.reset();
                setAction(next);
              }}
            >
              {names[next]}
            </PendingButton>
          ),
        )}
      </div>
      <Feedback
        error={action ? null : mutation.error}
        success={mutation.isSuccess ? "Job updated." : undefined}
      />
      <ConfirmDialog
        open={!!action}
        title={names[action ?? ""] ?? "Update job"}
        action={names[action ?? ""]}
        pending={mutation.isPending}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action === "cancel") void cancel.handleSubmit(perform)();
          else if (action === "repost") void repost.handleSubmit(perform)();
          else perform();
        }}
      >
        {action === "cancel" ? (
          <>
            <p className="notice">
              Active applications will become job cancelled, scheduled
              interviews will be cancelled, and affected candidates will be
              notified. Accepted offers prevent cancellation. This job cannot be
              reopened.
            </p>
            <Field
              label="Cancellation reason"
              error={cancel.formState.errors.reason?.message}
            >
              <textarea {...cancel.register("reason")} />
            </Field>
          </>
        ) : action === "repost" ? (
          <>
            <p>
              A new draft copies the role, skills, and benefits. Applications
              and history stay with this job. Duplicate protection applies when
              publishing the new draft.
            </p>
            <p className="small muted">
              New deadline times are in Asia/Kolkata (IST).
            </p>
            <Field
              label="New application deadline · IST"
              error={repost.formState.errors.applicationDeadline?.message}
            >
              <input
                type="datetime-local"
                {...repost.register("applicationDeadline")}
              />
            </Field>
            <Field
              label="New decision deadline · IST"
              error={repost.formState.errors.decisionDeadline?.message}
            >
              <input
                type="datetime-local"
                {...repost.register("decisionDeadline")}
              />
            </Field>
          </>
        ) : action === "publish" ? (
          <p>
            Publishing makes this role visible to candidates. The API validates
            deadlines, completeness, and active duplicates.
          </p>
        ) : action === "filled" ? (
          <p>
            All applications must have final outcomes and enough accepted offers
            must fill the openings. Sending offers alone does not fill a job.
            This is a terminal state.
          </p>
        ) : action === "applications_closed" ? (
          <p>
            Close application intake now. Existing applications remain in the
            hiring process. This job cannot return to open intake.
          </p>
        ) : (
          <p>
            Confirm that this job’s evaluation and hiring process is underway.
          </p>
        )}
        {mutation.error && <ErrorState error={mutation.error} />}
      </ConfirmDialog>
    </section>
  );
}
export function EmployerDashboard() {
  const { user } = useAuth();
  const jobs = useApiQuery(["employer-jobs", "limit=20&page=1"], (signal) =>
    api.employerJobs({ page: 1, limit: 20 }, signal),
  );
  const obligations = useApiQuery(["obligations"], api.obligations);
  const companies = useApiQuery(["companies"], api.companies);
  return (
    <>
      <PageHeader
        title={`Your hiring workspace, ${user!.firstName}.`}
        description="Keep hiring moving, and keep candidates informed."
        actions={
          <Link className="button" to="/employer/jobs/new">
            Create job +
          </Link>
        }
      />
      <div className="metrics">
        <Link to="/employer/jobs">
          <span>Total postings</span>
          <strong>
            {jobs.isPending ? (
              <InlineLoader />
            ) : (
              (jobs.data?.pagination.total ?? "—")
            )}
          </strong>
          <small>All jobs you can manage</small>
        </Link>
        <Link to="/employer/jobs">
          <span>Active recent jobs</span>
          <strong>
            {jobs.data ? (
              jobs.data.jobs.filter((j) =>
                ["open", "applications_closed", "hiring_in_progress"].includes(
                  j.status,
                ),
              ).length
            ) : jobs.isPending ? (
              <InlineLoader />
            ) : (
              "—"
            )}
          </strong>
          <small>Within the latest 20 postings</small>
        </Link>
        <Link to="/employer/feedback-obligations">
          <span>Overdue feedback</span>
          <strong>
            {obligations.isPending ? (
              <InlineLoader />
            ) : (
              (obligations.data?.overdueCount ?? "—")
            )}
          </strong>
          <small>Unresolved candidate obligations</small>
        </Link>
        <Link to="/employer/companies">
          <span>Company workspaces</span>
          <strong>
            {companies.isPending ? (
              <InlineLoader />
            ) : (
              (companies.data?.companies.length ?? "—")
            )}
          </strong>
          <small>Owner and recruiter memberships</small>
        </Link>
      </div>
      {obligations.error && (
        <ErrorState
          error={obligations.error}
          retry={() => void obligations.refetch()}
        />
      )}
      {companies.error && (
        <ErrorState
          error={companies.error}
          retry={() => void companies.refetch()}
        />
      )}
      {!!obligations.data?.overdueCount && (
        <div className="notice">
          <h2>Candidates are waiting for an outcome.</h2>
          <p>
            Review {obligations.data.overdueCount} overdue application(s) and
            communicate a clear decision.
          </p>
          <Link to="/employer/feedback-obligations">
            Review feedback obligations →
          </Link>
        </div>
      )}
      <section>
        <div className="section-label">
          <h2>Recent job activity</h2>
          <Link to="/employer/jobs">View all postings →</Link>
        </div>
        {jobs.isPending ? (
          <LoadingState />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} retry={() => void jobs.refetch()} />
        ) : jobs.data.jobs.length ? (
          jobs.data.jobs.slice(0, 6).map((j) => (
            <article className="panel list-row" key={j.id}>
              <div>
                <h3>
                  <Link to={`/employer/jobs/${j.id}`}>{j.title}</Link>
                </h3>
                <p className="small muted">
                  {j.company.name} · {j.applicationCount} applicant(s) ·{" "}
                  {j.openings} opening(s)
                </p>
                <p className="small">
                  Decision due {dateTime(j.decisionDeadline)}
                </p>
              </div>
              <div className="actions">
                <StatusBadge status={j.status} />
                <Link to={`/employer/jobs/${j.id}/applications`}>
                  Review applicants →
                </Link>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="Start a transparent hiring process">
            <Link to="/employer/companies">Set up a company</Link>, then create
            your first role.
          </EmptyState>
        )}
      </section>
    </>
  );
}
