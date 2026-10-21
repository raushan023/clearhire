import {
  InlineLoader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "../components/ui";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../lib/auth";
import { dateTime, isUnresolved } from "../lib/presentation";
export function CandidateDashboard() {
  const { user } = useAuth();
  const apps = useApiQuery(["applications"], api.applications);
  const saved = useApiQuery(["saved", 1], (signal) => api.saved(1, signal));
  if (apps.isPending) return <LoadingState />;
  if (apps.error)
    return <ErrorState error={apps.error} retry={() => void apps.refetch()} />;
  const active = apps.data.applications.filter((a) => isUnresolved(a.status)),
    offers = active.filter((a) => a.status === "offer"),
    interviewStage = active.filter((a) => a.status === "interview");
  return (
    <>
      <PageHeader
        title={`Good to see you, ${user!.firstName}.`}
        description="A clear view of where you stand, and what comes next."
        actions={
          <Link className="button" to="/candidate/jobs">
            Explore opportunities →
          </Link>
        }
      />
      <div className="metrics">
        <Link to="/candidate/applications">
          <span>Active applications</span>
          <strong>{active.length}</strong>
          <small>Progress you can follow</small>
        </Link>
        <Link to="/candidate/applications">
          <span>In interview stage</span>
          <strong>{interviewStage.length}</strong>
          <small>View schedules in each application</small>
        </Link>
        <Link to="/candidate/applications">
          <span>Offers awaiting you</span>
          <strong>{offers.length}</strong>
          <small>
            {offers.length
              ? "Your response is the next step"
              : "No response needed right now"}
          </small>
        </Link>
        <Link to="/candidate/saved-jobs">
          <span>Saved opportunities</span>
          <strong>
            {saved.isPending ? (
              <InlineLoader />
            ) : (
              (saved.data?.pagination.total ?? "—")
            )}
          </strong>
          <small>Keep your next move in view</small>
        </Link>
      </div>
      {saved.error && (
        <ErrorState error={saved.error} retry={() => void saved.refetch()} />
      )}
      {offers.length > 0 && (
        <section className="notice">
          <h2>You have {offers.length} pending offer(s)</h2>
          {offers.map((a) => (
            <p key={a.id}>
              <Link to={`/candidate/applications/${a.id}`}>
                Review your offer for {a.job.title}
              </Link>
            </p>
          ))}
        </section>
      )}
      <div className="grid-two">
        <section>
          <div className="section-label">
            <h2>Recent applications</h2>
            <Link to="/candidate/applications">View all →</Link>
          </div>
          {apps.data.applications.length ? (
            apps.data.applications.slice(0, 5).map((a) => (
              <article key={a.id} className="panel list-row">
                <div>
                  <h3>
                    <Link to={`/candidate/applications/${a.id}`}>
                      {a.job.title}
                    </Link>
                  </h3>
                  <p className="muted small">{a.job.company.name}</p>
                  <p className="small">
                    Decision due {dateTime(a.job.decisionDeadline)}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </article>
            ))
          ) : (
            <EmptyState title="Make your first move">
              <Link to="/candidate/jobs">
                Browse roles with clear salaries and deadlines.
              </Link>
            </EmptyState>
          )}
        </section>
        <aside>
          <section className="panel">
            <p className="eyebrow">THE NEXT STEP</p>
            <h2>Put your experience in context.</h2>
            <p className="muted">
              Keep your profile and resume current so employers can review your
              experience during active applications.
            </p>
            <Link className="button secondary" to="/candidate/profile">
              Review your profile
            </Link>
          </section>
          <section className="panel">
            <h2>Upcoming decisions</h2>
            {active.length ? (
              active
                .slice()
                .sort((a, b) =>
                  a.job.decisionDeadline.localeCompare(b.job.decisionDeadline),
                )
                .slice(0, 4)
                .map((a) => (
                  <UpcomingDecision
                    key={a.id}
                    applicationId={a.id}
                    jobId={a.job.id}
                    title={a.job.title}
                    deadline={a.job.decisionDeadline}
                  />
                ))
            ) : (
              <p className="muted">
                Decision commitments will appear after you apply.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
function UpcomingDecision({
  applicationId,
  jobId,
  title,
  deadline,
}: {
  applicationId: string;
  jobId: string;
  title: string;
  deadline: string;
}) {
  const job = useApiQuery(["job", jobId], (signal) => api.job(jobId, signal));
  return (
    <div className="decision-row">
      <Link to={`/candidate/applications/${applicationId}`}>{title}</Link>
      <p className="small muted">{dateTime(deadline)}</p>
      {job.isPending && <InlineLoader text="Checking decision status…" />}
      {job.data?.job.accountability.decisionDeadlineMissed && (
        <span className="overdue small">Employer decision deadline missed</span>
      )}
      {job.error && (
        <ErrorState error={job.error} retry={() => void job.refetch()} />
      )}
    </div>
  );
}
