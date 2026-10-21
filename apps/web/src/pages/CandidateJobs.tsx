import {
  PendingButton,
  InlineLoader,
  EmptyState,
  ErrorState,
  Feedback,
  Field,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
  label,
  ConfirmDialog,
} from "../components/ui";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { JobDescription, JobAccountability } from "../components/JobDetails";
import { api, allSavedJobs } from "../lib/api";
import { useApiMutation, useApiQuery } from "../lib/query";
import {
  canApply,
  dateTime,
  urlPage,
  viewerTimezone,
} from "../lib/presentation";
import {
  ChangeHistoryList,
  DeadlineDisplay,
  JobCard,
  JobStatusTimeline,
} from "../components/Recruitment";
import { useEffect, useState } from "react";
import { SkillPicker } from "../components/SkillPicker";
export function JobSearchPage() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams(params);
  query.set("page", String(urlPage(params)));
  query.set("limit", "20");
  query.delete("skillSearch");
  query.sort();
  const jobs = useApiQuery(["jobs", query.toString()], (signal) =>
    api.jobs(query, signal),
  );
  const [filtersOpen, setFiltersOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 760,
  );
  const selected = params.get("skillIds") ?? "";
  const [skillIds, setSkillIds] = useState(selected.split(",").filter(Boolean));
  useEffect(() => setSkillIds(selected.split(",").filter(Boolean)), [selected]);
  // skillSearch is UI-only and is never sent to the jobs endpoint.
  return (
    <>
      <PageHeader
        title="Find your next role"
        description="Clear requirements, published salaries, and a decision date you can follow."
      />
      <div className="search-layout">
        <details
          className="panel filters"
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary>Refine your search</summary>
          <form
            key={params.toString()}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget),
                next = new URLSearchParams();
              for (const [key, value] of data)
                if (typeof value === "string" && value.trim())
                  next.set(key, value.trim());
              next.set("page", "1");
              setParams(next);
            }}
          >
            <Field label="Job title or keywords">
              <input
                name="search"
                defaultValue={params.get("search") ?? ""}
                placeholder="e.g. Backend engineer"
              />
            </Field>
            <Field label="Work mode">
              <select
                name="workMode"
                defaultValue={params.get("workMode") ?? ""}
              >
                <option value="">All work modes</option>
                {["remote", "hybrid", "onsite"].map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employment type">
              <select
                name="employmentType"
                defaultValue={params.get("employmentType") ?? ""}
              >
                <option value="">All types</option>
                {["full_time", "part_time", "contract", "internship"].map(
                  (x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Country">
              <input
                name="country"
                defaultValue={params.get("country") ?? ""}
              />
            </Field>
            <Field label="City">
              <input name="city" defaultValue={params.get("city") ?? ""} />
            </Field>
            <Field label="Your experience (years)">
              <input
                name="experienceMin"
                type="number"
                min="0"
                step="0.1"
                defaultValue={params.get("experienceMin") ?? ""}
              />
            </Field>
            <Field label="Minimum salary">
              <input
                name="salaryMin"
                type="number"
                min="0"
                step="1"
                defaultValue={params.get("salaryMin") ?? ""}
              />
            </Field>
            <input type="hidden" name="skillIds" value={skillIds.join(",")} />
            <SkillPicker
              label="Matching skills"
              value={skillIds}
              onChange={setSkillIds}
            />
            <PendingButton
              className="full"
              pending={jobs.isFetching}
              pendingText="Finding roles…"
            >
              Apply filters
            </PendingButton>
            <button
              type="button"
              className="secondary full mt-3"
              onClick={() => {
                setSkillIds([]);
                setParams({});
              }}
            >
              Clear filters
            </button>
          </form>
        </details>
        <section aria-label="Job results">
          {jobs.isPending ? (
            <LoadingState />
          ) : jobs.error ? (
            <ErrorState error={jobs.error} retry={() => void jobs.refetch()} />
          ) : (
            <>
              <div className="section-label">
                <span>{jobs.data.pagination.total} opportunities</span>
                <span>Times in {viewerTimezone()}</span>
              </div>
              {jobs.data.jobs.length ? (
                jobs.data.jobs.map((job) => <JobCard key={job.id} job={job} />)
              ) : (
                <EmptyState title="No matching roles">
                  Try broader filters or another location.
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
        </section>
      </div>
    </>
  );
}
export function CandidateJobPage() {
  const { jobId = "" } = useParams(),
    navigate = useNavigate(),
    [confirm, setConfirm] = useState(false);
  const job = useApiQuery(["job", jobId], (signal) => api.job(jobId, signal));
  const apps = useApiQuery(["applications"], api.applications);
  const saved = useApiQuery(["saved-index"], allSavedJobs);
  const apply = useApiMutation(api.apply, ["applications", "job", "unread"]);
  const saving = useApiMutation(
    async (remove: boolean) => (remove ? api.unsave(jobId) : api.save(jobId)),
    ["saved", "saved-index", "job"],
  );
  if (job.isPending) return <LoadingState />;
  if (job.error)
    return <ErrorState error={job.error} retry={() => void job.refetch()} />;
  const j = job.data.job,
    existing = apps.data?.applications.find((a) => a.job.id === j.id),
    isSaved = saved.data?.some((s) => s.id === j.id) ?? false;
  return (
    <>
      <PageHeader
        title={j.title}
        description={j.company.name}
        actions={
          <Link className="button secondary" to="/candidate/jobs">
            All jobs
          </Link>
        }
      />
      <div className="grid-two">
        <div>
          <JobDescription job={j} />
          <JobStatusTimeline events={j.statusHistory} />
          <ChangeHistoryList events={j.changeHistory} />
        </div>
        <aside>
          <section className="panel">
            <StatusBadge status={j.status} />
            <div className="stack mt-4">
              <DeadlineDisplay
                label="Application deadline"
                value={j.applicationDeadline}
              />
              <DeadlineDisplay
                label="Expected decision"
                value={j.decisionDeadline}
                missed={j.accountability.decisionDeadlineMissed}
              />
              <p className="small muted">Times in {viewerTimezone()}</p>
              {apps.error && (
                <ErrorState
                  error={apps.error}
                  retry={() => void apps.refetch()}
                />
              )}
              {saved.error && (
                <ErrorState
                  error={saved.error}
                  retry={() => void saved.refetch()}
                />
              )}
              {existing ? (
                <Link
                  className="button full"
                  to={`/candidate/applications/${existing.id}`}
                >
                  View your application
                </Link>
              ) : apps.isPending ? (
                <InlineLoader text="Checking your applications…" />
              ) : canApply(j.status, j.applicationDeadline, false) &&
                !apps.error ? (
                <button
                  className="full"
                  onClick={() => setConfirm(true)}
                  disabled={apply.isPending}
                >
                  Apply for this role
                </button>
              ) : apps.error ? (
                <p className="muted small">
                  Application history is needed before applying. Retry the
                  request above.
                </p>
              ) : (
                <p className="notice">Application intake is closed.</p>
              )}
              {saved.isPending && <InlineLoader text="Checking saved jobs…" />}
              {!saved.error &&
                !saved.isPending &&
                (isSaved || j.status === "open") && (
                  <PendingButton
                    className="secondary full"
                    disabled={saving.isPending}
                    pending={saving.isPending}
                    pendingText="Updating saved jobs…"
                    onClick={() => saving.mutate(isSaved)}
                  >
                    {isSaved ? "Remove from saved jobs" : "Save this job"}
                  </PendingButton>
                )}
              <Feedback
                error={apply.error ?? saving.error}
                success={saving.isSuccess ? "Saved jobs updated." : undefined}
              />
            </div>
          </section>
          <JobAccountability job={j} />
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Submit your application?"
        action="Apply"
        pending={apply.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          apply.mutate(jobId, {
            onSuccess: (result) => {
              setConfirm(false);
              navigate(`/candidate/applications/${result.application.id}`);
            },
          })
        }
      >
        <p>
          You can apply once to this role. Follow the application timeline for
          updates.
        </p>
        {apply.error && <ErrorState error={apply.error} />}
      </ConfirmDialog>
    </>
  );
}
export function SavedJobsPage() {
  const [params, setParams] = useSearchParams(),
    page = urlPage(params);
  const saved = useApiQuery(["saved", page], (signal) =>
    api.saved(page, signal),
  );
  const remove = useApiMutation(api.unsave, ["saved", "saved-index", "job"]);
  return (
    <>
      <PageHeader
        title="Saved jobs"
        description="Keep track of roles, including their current hiring status."
      />
      <Feedback
        error={remove.error}
        success={remove.isSuccess ? "Job removed from saved jobs." : undefined}
      />
      {saved.isPending ? (
        <LoadingState />
      ) : saved.error ? (
        <ErrorState error={saved.error} retry={() => void saved.refetch()} />
      ) : (
        <>
          {saved.data.jobs.length ? (
            saved.data.jobs.map((job) => (
              <article className="panel list-row" key={job.id}>
                <div>
                  <h2>
                    <Link to={`/candidate/jobs/${job.id}`}>{job.title}</Link>
                  </h2>
                  <p className="muted">{job.company.name}</p>
                  <span className="small">
                    Apply by {dateTime(job.applicationDeadline)} · Decision by{" "}
                    {dateTime(job.decisionDeadline)}
                  </span>
                </div>
                <div className="actions">
                  <StatusBadge status={job.status} />
                  <PendingButton
                    className="secondary"
                    disabled={remove.isPending}
                    pending={remove.isPending && remove.variables === job.id}
                    pendingText="Removing…"
                    onClick={() => remove.mutate(job.id)}
                  >
                    Unsave
                  </PendingButton>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Your shortlist starts here">
              <Link to="/candidate/jobs">
                Browse roles and save the ones that interest you.
              </Link>
            </EmptyState>
          )}
          <Pagination
            pending={saved.isFetching}
            info={saved.data.pagination}
            onPage={(page) => setParams({ page: String(page) })}
          />
        </>
      )}
    </>
  );
}
