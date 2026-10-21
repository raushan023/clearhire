import { memo } from "react";
import { Link } from "react-router-dom";
import { dateTime, money } from "../lib/presentation";
import { label, StatusBadge } from "./ui";
import type { ApplicationDetail, Job, JobSummary } from "../lib/types";
export function DeadlineDisplay({
  label: text,
  value,
  missed = false,
}: {
  label: string;
  value: string;
  missed?: boolean;
}) {
  return (
    <div className={missed ? "deadline overdue" : "deadline"}>
      <span>{text}</span>
      <strong>
        <time dateTime={value}>{dateTime(value)}</time>
      </strong>
      {missed && <small>Decision commitment missed</small>}
    </div>
  );
}
export function JobCard({ job }: { job: JobSummary }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div>
          <p className="eyebrow">{job.company.name}</p>
          <h2>
            <Link to={`/candidate/jobs/${job.id}`}>{job.title}</Link>
          </h2>
          <p className="muted small">
            {[job.location.city, job.location.country]
              .filter(Boolean)
              .join(", ")}{" "}
            <span aria-hidden="true">·</span> {label(job.workMode)}{" "}
            <span aria-hidden="true">·</span> {label(job.employmentType)}
          </p>
        </div>
        <StatusBadge
          status={
            job.status ??
            (new Date(job.applicationDeadline).getTime() > Date.now()
              ? "open"
              : "applications_closed")
          }
        />
      </div>
      <div className="job-facts">
        <span>
          {money(
            job.salary.min,
            job.salary.max,
            job.salary.currency,
            job.salary.period,
          )}
        </span>
        <span>
          {job.experience.min}–{job.experience.max} years
        </span>
        <span>
          {job.openings} opening{job.openings === 1 ? "" : "s"}
        </span>
      </div>
      <div className="deadline-grid">
        <DeadlineDisplay label="Apply by" value={job.applicationDeadline} />
        <DeadlineDisplay
          label="Decision by"
          value={job.decisionDeadline}
          missed={!!job.decisionDeadlineMissedAt}
        />
      </div>
    </article>
  );
}
export const ApplicationStatusTimeline = memo(
  function ApplicationStatusTimeline({
    events,
  }: {
    events: ApplicationDetail["timeline"];
  }) {
    return (
      <section className="panel">
        <h2>Application timeline</h2>
        {events.length ? (
          <ol className="timeline">
            {events.map((event, index) => (
              <li key={index}>
                <StatusBadge status={event.toStatus} />
                <time dateTime={event.createdAt}>
                  {dateTime(event.createdAt)}
                </time>
                {event.note && <p>{event.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No timeline events available.</p>
        )}
      </section>
    );
  },
);
export const JobStatusTimeline = memo(function JobStatusTimeline({
  events,
}: {
  events: Job["statusHistory"];
}) {
  return (
    <section className="panel">
      <h2>Job status history</h2>
      {events.length ? (
        <ol className="timeline">
          {events.map((event, index) => (
            <li key={index}>
              <StatusBadge status={event.toStatus} />
              <span className="small muted">{label(event.source)}</span>
              <time dateTime={event.createdAt}>
                {dateTime(event.createdAt)}
              </time>
              {event.note && <p>{event.note}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No status changes recorded.</p>
      )}
    </section>
  );
});
function auditText(value: unknown) {
  if (value == null || value === "") return "Not set";
  if (Array.isArray(value)) return value.join(", ") || "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export const ChangeHistoryList = memo(function ChangeHistoryList({
  events,
}: {
  events: Job["changeHistory"];
}) {
  return (
    <section className="panel">
      <h2>Published content changes</h2>
      <p className="small muted">
        A record of meaningful changes after publication.
      </p>
      {events.length ? (
        <ul className="change-list">
          {events.map((event, index) => (
            <li key={index}>
              <div>
                <strong>{label(event.fieldName)}</strong>
                <time dateTime={event.changedAt}>
                  {dateTime(event.changedAt)}
                </time>
              </div>
              <p>
                <span className="muted">Before:</span>{" "}
                {auditText(event.oldValue)}
              </p>
              <p>
                <span className="muted">After:</span>{" "}
                {auditText(event.newValue)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No published content changes recorded.</p>
      )}
    </section>
  );
});
