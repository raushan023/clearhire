import { dateTime, money, safeUrl } from "../lib/presentation";
import { StatusBadge, label } from "./ui";
export function JobDescription({
  job: j,
}: {
  job: import("../lib/types").Job;
}) {
  return (
    <>
      <section className="panel">
        <div className="actions mb-4">
          <StatusBadge status={j.status} />
          <span className="small muted">
            {label(j.workMode)} · {label(j.employmentType)}
          </span>
        </div>
        <h2>About the role</h2>
        <p className="preserve">{j.description}</p>
        <dl className="facts-grid">
          <div>
            <dt>Location</dt>
            <dd>
              {[j.location.city, j.location.state, j.location.country]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
          <div>
            <dt>Compensation</dt>
            <dd>
              {money(
                j.salary.min,
                j.salary.max,
                j.salary.currency,
                j.salary.period,
              )}
            </dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>
              {j.experience.min}–{j.experience.max} years
            </dd>
          </div>
          <div>
            <dt>Openings</dt>
            <dd>{j.openings}</dd>
          </div>
        </dl>
        {[
          ["Required skills", j.requiredSkills],
          ["Preferred skills", j.preferredSkills],
          ["Benefits", j.benefits],
        ].map(([name, items]) => (
          <div key={name as string} className="mt-5">
            <h3>{name as string}</h3>
            <div className="chips">
              {(items as { id: string; name: string }[]).length ? (
                (items as { id: string; name: string }[]).map((item) => (
                  <span key={item.id} className="chip">
                    {item.name}
                  </span>
                ))
              ) : (
                <p className="small muted">None listed</p>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>About {j.company.name}</h2>
        <p className="preserve">
          {j.company.description || "No company description provided."}
        </p>
        {safeUrl(j.company.website) && (
          <a href={safeUrl(j.company.website)} target="_blank" rel="noreferrer">
            Visit company website ↗
          </a>
        )}
      </section>
    </>
  );
}
export function JobAccountability({
  job: j,
}: {
  job: import("../lib/types").Job;
}) {
  return (
    <section className="panel">
      <h2>Hiring transparency</h2>
      {j.accountability.decisionDeadlineMissed ? (
        <div className="notice">
          <strong>Decision commitment missed</strong>
          <p>
            The deadline crossed on{" "}
            {dateTime(j.accountability.decisionDeadlineMissedAt)}. This remains
            in the record.
          </p>
          <span>
            {j.accountability.candidatesAwaitingOutcome} candidate(s) still
            awaiting an outcome.
          </span>
        </div>
      ) : (
        <p className="muted small">
          No missed decision deadline has been recorded.
        </p>
      )}
      {j.applicationsClosedAt && (
        <p className="small">
          Applications closed {dateTime(j.applicationsClosedAt)} by{" "}
          {j.applicationsClosedBy}.
        </p>
      )}
      {j.cancelledAt && (
        <>
          <p className="small">Cancelled {dateTime(j.cancelledAt)}</p>
          <p>{j.cancellationReason}</p>
        </>
      )}
      {j.parentJobId && (
        <p className="small">
          Reposted from an earlier hiring cycle. Previous job reference:{" "}
          <span className="reference">{j.parentJobId}</span>
        </p>
      )}
    </section>
  );
}
