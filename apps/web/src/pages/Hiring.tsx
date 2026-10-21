import {
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
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../lib/api";
import { useApiMutation, useApiQuery } from "../lib/query";
import {
  applicationStatuses,
  dateTime,
  employerTransitions,
  platformInput,
  platformIso,
  urlPage,
} from "../lib/presentation";
import { interviewSchema } from "../lib/forms";
import type { ApplicationDetail, Interview } from "../lib/types";
import { ApplicationStatusTimeline } from "../components/Recruitment";
import { ApplicationSummary, Interviews } from "./Applications";
export function ApplicantsPage() {
  const { jobId = "" } = useParams(),
    [params, setParams] = useSearchParams();
  const queryParams = new URLSearchParams(params);
  queryParams.set("page", String(urlPage(params)));
  queryParams.set("limit", "20");
  queryParams.sort();
  const query = useApiQuery(
    ["applicants", jobId, queryParams.toString()],
    (signal) => api.applicants(jobId, queryParams, signal),
  );
  const job = useApiQuery(["job", jobId], (signal) => api.job(jobId, signal));
  return (
    <>
      <PageHeader
        title="Applicants"
        description={
          job.data?.job.title ??
          "Review applications and move each candidate toward a clear outcome."
        }
        actions={
          <Link className="button secondary" to={`/employer/jobs/${jobId}`}>
            View job
          </Link>
        }
      />
      {job.error && (
        <ErrorState error={job.error} retry={() => void job.refetch()} />
      )}
      <div className="panel">
        <Field label="Application status">
          <select
            value={params.get("status") ?? ""}
            onChange={(event) =>
              setParams(
                event.target.value ? { status: event.target.value } : {},
              )
            }
          >
            <option value="">All outcomes and active stages</option>
            {applicationStatuses.map((status) => (
              <option value={status} key={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.applications.length ? (
            <div className="panel table-wrap">
              <table>
                <caption className="sr-only">Job applicants</caption>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Status</th>
                    <th>Applied</th>
                    <th>Updated</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.applications.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/employer/applications/${a.id}`}>
                          {a.candidate.firstName} {a.candidate.lastName}
                        </Link>
                        <span className="table-sub">{a.candidate.email}</span>
                      </td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                      <td>{dateTime(a.appliedAt)}</td>
                      <td>{dateTime(a.updatedAt)}</td>
                      <td>
                        <Link to={`/employer/applications/${a.id}`}>
                          Open application →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No applicants in this view">
              Try another status filter, or return when candidates have applied.
            </EmptyState>
          )}
          <Pagination
            pending={query.isFetching}
            info={query.data.pagination}
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
export function EmployerApplicationPage() {
  const { applicationId = "" } = useParams();
  const query = useApiQuery(["application", applicationId], (signal) =>
    api.application(applicationId, true, signal),
  );
  const [interview, setInterview] = useState<Interview | "new" | null>(null),
    [cancel, setCancel] = useState<Interview | null>(null);
  const cancelMutation = useApiMutation(api.cancelInterview, [
    "application",
    "applicants",
    "unread",
  ]);
  const download = useApiMutation(
    (filename: string) => api.downloadResume(filename, applicationId),
    [],
  );
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const a = query.data.application,
    candidate = a.candidate;
  return (
    <>
      <PageHeader
        title={
          candidate
            ? `${candidate.firstName} ${candidate.lastName}`
            : "Candidate application"
        }
        description={`${a.job.title} · ${a.job.company.name}`}
        actions={
          <Link
            className="button secondary"
            to={`/employer/jobs/${a.job.id}/applications`}
          >
            All applicants
          </Link>
        }
      />
      <div className="grid-two">
        <div>
          <ApplicationSummary application={a} />
          <section className="panel">
            <h2>Candidate profile</h2>
            {candidate && <p className="small muted">{candidate.email}</p>}
            {candidate?.profile ? (
              <>
                <h3>{candidate.profile.headline || "Profile"}</h3>
                <p className="preserve">{candidate.profile.summary}</p>
                <dl className="facts-grid">
                  <div>
                    <dt>Experience</dt>
                    <dd>
                      {candidate.profile.totalExperience == null
                        ? "Not provided"
                        : `${candidate.profile.totalExperience} years`}
                    </dd>
                  </div>
                  <div>
                    <dt>Current position</dt>
                    <dd>
                      {[
                        candidate.profile.currentTitle,
                        candidate.profile.currentCompany,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {[
                        candidate.profile.city,
                        candidate.profile.state,
                        candidate.profile.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </dd>
                  </div>
                </dl>
                <div className="chips">
                  {candidate.profile.skills.map((skill) => (
                    <span className="chip" key={skill.id}>
                      {skill.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">
                Current profile data is unavailable. Resolved applications do
                not grant live profile access.
              </p>
            )}
            {a.resume ? (
              <div className="mt-5">
                <h3>Current resume</h3>
                <p>
                  {a.resume.filename} · {Math.ceil(a.resume.sizeBytes / 1024)}{" "}
                  KB
                </p>
                <PendingButton
                  className="secondary"
                  disabled={download.isPending}
                  pending={download.isPending}
                  pendingText="Downloading…"
                  onClick={() => download.mutate(a.resume!.filename)}
                >
                  Download candidate resume
                </PendingButton>
                <p className="small muted">
                  This is the current active file, not an application-time
                  snapshot.
                </p>
              </div>
            ) : (
              <p className="muted small mt-4">
                No resume is available through this application.
              </p>
            )}
            <Feedback error={download.error} />
          </section>
          <ApplicationStatusTimeline events={a.timeline} />
          <Interviews
            application={a}
            controls={(item) =>
              item.status === "scheduled" ? (
                <div className="actions">
                  {a.status === "interview" && (
                    <button
                      disabled={cancelMutation.isPending}
                      className="secondary small"
                      onClick={() => setInterview(item)}
                    >
                      Reschedule
                    </button>
                  )}
                  <button
                    disabled={cancelMutation.isPending}
                    className="secondary small"
                    onClick={() => {
                      cancelMutation.reset();
                      setCancel(item);
                    }}
                  >
                    Cancel interview
                  </button>
                </div>
              ) : null
            }
          />
        </div>
        <aside>
          <StatusActions key={a.status} application={a} />
          {a.status === "interview" && (
            <section className="panel">
              <h2>Plan the next conversation</h2>
              <p className="muted">
                Candidates receive a notification when an interview is scheduled
                or changed.
              </p>
              <button
                disabled={cancelMutation.isPending}
                onClick={() => setInterview("new")}
              >
                Schedule interview
              </button>
            </section>
          )}
        </aside>
      </div>
      {interview && (
        <InterviewEditor
          applicationId={applicationId}
          interview={interview === "new" ? undefined : interview}
          onClose={() => setInterview(null)}
        />
      )}
      <ConfirmDialog
        open={!!cancel}
        title="Cancel this interview?"
        action="Cancel interview"
        pending={cancelMutation.isPending}
        onCancel={() => setCancel(null)}
        onConfirm={() =>
          cancel &&
          cancelMutation.mutate(cancel.id, { onSuccess: () => setCancel(null) })
        }
      >
        <p>
          The candidate will be notified. The cancelled interview remains in the
          history; the application stage stays unchanged.
        </p>
        {cancelMutation.error && <ErrorState error={cancelMutation.error} />}
      </ConfirmDialog>
    </>
  );
}
function StatusActions({ application: a }: { application: ApplicationDetail }) {
  const next = employerTransitions(a.status),
    [confirm, setConfirm] = useState(false);
  const form = useForm<{ status: string; note: string }>({
    resolver: zodResolver(
      z.object({
        status: z.string().min(1),
        note: z.string().trim().max(1000),
      }),
    ),
    defaultValues: { status: next[0] ?? "", note: "" },
  });
  const mutation = useApiMutation(
    (values: { status: string; note: string }) =>
      api.applicationStatus(a.id, values.status, values.note),
    [
      "application",
      "applicants",
      "employer-jobs",
      "job",
      "obligations",
      "unread",
    ],
  );
  return (
    <section className="panel">
      <h2>Application actions</h2>
      {next.length ? (
        <form onSubmit={form.handleSubmit(() => setConfirm(true))}>
          <Field
            label="Next stage"
            error={form.formState.errors.status?.message}
          >
            <select {...form.register("status")}>
              {next.map((status) => (
                <option value={status} key={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Note for the candidate (optional)"
            error={form.formState.errors.note?.message}
          >
            <textarea {...form.register("note")} />
          </Field>
          <PendingButton
            disabled={mutation.isPending}
            pending={mutation.isPending}
            pendingText="Saving…"
          >
            Review status update
          </PendingButton>
        </form>
      ) : (
        <p className="muted">
          {a.status === "offer"
            ? "The offer is awaiting the candidate’s response. Only the candidate can accept or decline."
            : "This application has a final outcome. No employer status changes are available."}
        </p>
      )}
      <ConfirmDialog
        open={confirm}
        title={`Move to ${label(form.watch("status") || "next stage")}?`}
        action="Update status"
        pending={mutation.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          mutation.mutate(form.getValues(), {
            onSuccess: () => setConfirm(false),
          })
        }
      >
        <p>
          The transition and note will be recorded in the candidate-visible
          timeline.
        </p>
        {form.watch("status") === "offer" && (
          <p>
            The backend checks pending and accepted offers against openings
            before issuing this offer.
          </p>
        )}
        {form.watch("status") === "rejected" && (
          <p>
            Rejection is a final outcome and ends current profile/resume access
            through this application.
          </p>
        )}
        {mutation.error && <ErrorState error={mutation.error} />}
      </ConfirmDialog>
    </section>
  );
}
function InterviewEditor({
  applicationId,
  interview,
  onClose,
}: {
  applicationId: string;
  interview?: Interview;
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof interviewSchema>>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      scheduledAt: interview ? platformInput(interview.scheduledAt) : "",
      mode: interview?.mode ?? "video",
      meetingLink: interview?.meetingLink ?? "",
      location: interview?.location ?? "",
      notes: interview?.notes ?? "",
    },
  });
  const mutation = useApiMutation(
    async (values: z.infer<typeof interviewSchema>) => {
      const body = {
        scheduledAt: platformIso(values.scheduledAt),
        mode: values.mode,
        ...(values.meetingLink ? { meetingLink: values.meetingLink } : {}),
        ...(values.location ? { location: values.location } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      };
      return interview
        ? api.rescheduleInterview(interview.id, body)
        : api.scheduleInterview(applicationId, body);
    },
    ["application", "applicants", "unread"],
  );
  const e = form.formState.errors;
  return (
    <ConfirmDialog
      open
      title={interview ? "Reschedule interview" : "Schedule interview"}
      action={interview ? "Save interview" : "Schedule interview"}
      pending={mutation.isPending}
      onCancel={onClose}
      onConfirm={() =>
        void form.handleSubmit((values) =>
          mutation.mutate(values, { onSuccess: onClose }),
        )()
      }
    >
      <p className="notice small">
        Enter the time in Asia/Kolkata (IST, UTC+05:30).
      </p>
      <Field
        label="Scheduled date and time · IST"
        error={e.scheduledAt?.message}
      >
        <input type="datetime-local" {...form.register("scheduledAt")} />
      </Field>
      <Field label="Interview mode" error={e.mode?.message}>
        <select {...form.register("mode")}>
          <option value="video">Video</option>
          <option value="phone">Phone</option>
          <option value="onsite">Onsite</option>
        </select>
      </Field>
      <Field
        label="Meeting link (required for video)"
        error={e.meetingLink?.message}
      >
        <input type="url" {...form.register("meetingLink")} />
      </Field>
      <Field label="Location (required for onsite)" error={e.location?.message}>
        <input {...form.register("location")} />
      </Field>
      <Field label="Notes / instructions" error={e.notes?.message}>
        <textarea {...form.register("notes")} />
      </Field>
      {mutation.error && <ErrorState error={mutation.error} />}
    </ConfirmDialog>
  );
}
export function FeedbackObligationsPage() {
  const query = useApiQuery(["obligations"], api.obligations);
  return (
    <>
      <PageHeader
        title="Feedback obligations"
        description="A deadline is a commitment. Give every unresolved candidate an outcome."
      />
      <p className="notice">
        Warnings progress through initial, 24-hour, and 72-hour stages while
        feedback remains unresolved. They do not mean an account has been
        suspended.{" "}
        <Link to="/employer/notifications">
          View the actual warnings in notifications.
        </Link>
      </p>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.obligations.length ? (
        <>
          <p className="small muted">
            {query.data.overdueCount} application(s) require overdue feedback.
          </p>
          <div className="panel table-wrap">
            <table>
              <caption className="sr-only">
                Overdue feedback obligations
              </caption>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role / company</th>
                  <th>Current stage</th>
                  <th>Decision commitment missed</th>
                  <th>Resolve</th>
                </tr>
              </thead>
              <tbody>
                {query.data.obligations.map((o) => (
                  <tr key={o.applicationId}>
                    <td>
                      {o.candidate.firstName} {o.candidate.lastName}
                      <span className="table-sub">{o.candidate.email}</span>
                    </td>
                    <td>
                      <Link to={`/employer/jobs/${o.job.id}`}>
                        {o.job.title}
                      </Link>
                      <span className="table-sub">{o.job.company.name}</span>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>
                      {dateTime(o.job.decisionDeadlineMissedAt)}
                      <span className="table-sub">
                        Decision deadline: {dateTime(o.job.decisionDeadline)}
                      </span>
                    </td>
                    <td>
                      <Link to={`/employer/applications/${o.applicationId}`}>
                        Review application →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState title="No overdue feedback obligations">
          Keep your candidates informed as hiring progresses.
        </EmptyState>
      )}
    </>
  );
}
