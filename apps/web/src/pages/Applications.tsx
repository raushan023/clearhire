import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import { useApiMutation, useApiQuery } from "../lib/query";
import {
  canRespondToOffer,
  canWithdraw,
  dateTime,
  safeUrl,
  viewerTimezone,
} from "../lib/presentation";
import { ApplicationStatusTimeline } from "../components/Recruitment";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Feedback,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "../components/ui";
import type { ApplicationDetail } from "../lib/types";
export function ApplicationsPage() {
  const apps = useApiQuery(["applications"], api.applications);
  return (
    <>
      <PageHeader
        title="Your applications"
        description="Every stage, deadline, and outcome in one place."
      />
      {apps.isPending ? (
        <LoadingState />
      ) : apps.error ? (
        <ErrorState error={apps.error} retry={() => void apps.refetch()} />
      ) : apps.data.applications.length ? (
        <div className="panel table-wrap">
          <table>
            <caption className="sr-only">Your applications</caption>
            <thead>
              <tr>
                <th>Role / company</th>
                <th>Status</th>
                <th>Applied / updated</th>
                <th>Application / decision deadline</th>
              </tr>
            </thead>
            <tbody>
              {apps.data.applications.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/candidate/applications/${a.id}`}>
                      {a.job.title}
                    </Link>
                    <span className="table-sub">{a.job.company.name}</span>
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    {dateTime(a.appliedAt)}
                    <span className="table-sub">
                      Updated {dateTime(a.updatedAt)}
                    </span>
                  </td>
                  <td>
                    {dateTime(a.job.applicationDeadline)}
                    <span className="table-sub">
                      Decision {dateTime(a.job.decisionDeadline)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Your next chapter starts with an application">
          <Link to="/candidate/jobs">
            Find a role that fits your experience.
          </Link>
        </EmptyState>
      )}
    </>
  );
}
export function CandidateApplicationPage() {
  const { applicationId = "" } = useParams();
  const query = useApiQuery(["application", applicationId], (signal) =>
    api.application(applicationId, false, signal),
  );
  const [action, setAction] = useState<
    "withdraw" | "offer_accepted" | "offer_declined" | null
  >(null);
  const mutation = useApiMutation(
    async (next: NonNullable<typeof action>) =>
      next === "withdraw"
        ? api.withdraw(applicationId)
        : api.offerResponse(applicationId, next),
    ["applications", "application", "job", "unread"],
  );
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const a = query.data.application;
  return (
    <>
      <PageHeader
        title={a.job.title}
        description={`Your application to ${a.job.company.name}`}
        actions={
          <Link className="button secondary" to={`/candidate/jobs/${a.job.id}`}>
            View job
          </Link>
        }
      />
      <div className="grid-two">
        <div>
          <ApplicationSummary application={a} />
          <ApplicationStatusTimeline events={a.timeline} />
          <Interviews application={a} />
        </div>
        <aside className="panel">
          <h2>Your next step</h2>
          {canRespondToOffer(a.status) ? (
            <>
              <p>
                You have an offer. Review the role and choose your response.
              </p>
              <div className="actions">
                <button
                  disabled={mutation.isPending}
                  onClick={() => {
                    mutation.reset();
                    setAction("offer_accepted");
                  }}
                >
                  Accept offer
                </button>
                <button
                  disabled={mutation.isPending}
                  className="secondary"
                  onClick={() => {
                    mutation.reset();
                    setAction("offer_declined");
                  }}
                >
                  Decline offer
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              {canWithdraw(a.status)
                ? "Your application is active. Check this page for employer updates and interview details."
                : "This application has a final outcome. Its full history remains available."}
            </p>
          )}
          {canWithdraw(a.status) && (
            <button
              disabled={mutation.isPending}
              className="secondary"
              onClick={() => {
                mutation.reset();
                setAction("withdraw");
              }}
            >
              Withdraw application
            </button>
          )}
          <Feedback
            success={
              mutation.isSuccess
                ? "Your application has been updated."
                : undefined
            }
            error={action ? null : mutation.error}
          />
        </aside>
      </div>
      <ConfirmDialog
        open={!!action}
        title={
          action === "withdraw"
            ? "Withdraw your application?"
            : action === "offer_accepted"
              ? "Accept this offer?"
              : "Decline this offer?"
        }
        action={
          action === "withdraw"
            ? "Withdraw"
            : action === "offer_accepted"
              ? "Accept offer"
              : "Decline offer"
        }
        pending={mutation.isPending}
        onCancel={() => setAction(null)}
        onConfirm={() =>
          action &&
          mutation.mutate(action, { onSuccess: () => setAction(null) })
        }
      >
        <p>
          This records a final outcome and cannot be undone through this
          application.
        </p>
        {mutation.error && <ErrorState error={mutation.error} />}
      </ConfirmDialog>
    </>
  );
}
export function ApplicationSummary({
  application: a,
}: {
  application: ApplicationDetail;
}) {
  return (
    <section className="panel">
      <div className="list-row">
        <h2>Application overview</h2>
        <StatusBadge status={a.status} />
      </div>
      <dl className="facts-grid">
        <div>
          <dt>Applied</dt>
          <dd>{dateTime(a.appliedAt)}</dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>{dateTime(a.updatedAt)}</dd>
        </div>
        <div>
          <dt>Application deadline</dt>
          <dd>{dateTime(a.job.applicationDeadline)}</dd>
        </div>
        <div>
          <dt>Decision deadline</dt>
          <dd>{dateTime(a.job.decisionDeadline)}</dd>
        </div>
        <div>
          <dt>Job status</dt>
          <dd>
            <StatusBadge status={a.job.status} />
          </dd>
        </div>
      </dl>
      <p className="small muted">Times in {viewerTimezone()}</p>
    </section>
  );
}
export function Interviews({
  application: a,
  controls,
}: {
  application: ApplicationDetail;
  controls?: (
    interview: ApplicationDetail["interviews"][number],
  ) => React.ReactNode;
}) {
  return (
    <section className="panel">
      <h2>Interviews</h2>
      {a.interviews.length ? (
        a.interviews.map((i) => (
          <article className="interview" key={i.id}>
            <div className="list-row">
              <strong>{dateTime(i.scheduledAt)}</strong>
              <StatusBadge status={i.status} />
            </div>
            <p className="small muted">
              {i.mode} · {viewerTimezone()}
            </p>
            {i.meetingLink && safeUrl(i.meetingLink) && (
              <p>
                <a
                  href={safeUrl(i.meetingLink)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {i.status === "cancelled"
                    ? "Previously scheduled meeting link"
                    : "Open interview meeting"}{" "}
                  ↗
                </a>
              </p>
            )}
            {i.location && <p>{i.location}</p>}
            {i.notes && <p className="preserve">{i.notes}</p>}
            {i.cancelledAt && (
              <p className="small muted">Cancelled {dateTime(i.cancelledAt)}</p>
            )}
            {controls?.(i)}
          </article>
        ))
      ) : (
        <p className="muted">No interviews scheduled yet.</p>
      )}
    </section>
  );
}
