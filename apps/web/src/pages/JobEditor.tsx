import {
  PendingButton,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  label,
} from "../components/ui";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { useApiMutation, useApiQuery } from "../lib/query";
import { jobFormSchema, type JobFormValues } from "../lib/forms";
import { platformInput, platformIso } from "../lib/presentation";
import type { Company, Job } from "../lib/types";
import { SkillPicker } from "../components/SkillPicker";
export function JobEditorPage() {
  const { jobId } = useParams();
  const companies = useApiQuery(["companies"], api.companies);
  const job = useApiQuery(
    ["job", jobId],
    (signal) => api.job(jobId!, signal),
    !!jobId,
  );
  if (companies.isPending || (jobId && job.isPending)) return <LoadingState />;
  if (companies.error)
    return (
      <ErrorState
        error={companies.error}
        retry={() => void companies.refetch()}
      />
    );
  if (jobId && job.error)
    return <ErrorState error={job.error} retry={() => void job.refetch()} />;
  if (!companies.data.companies.length)
    return (
      <EmptyState title="Create a company first">
        <Link to="/employer/companies">Set up your company workspace.</Link>
      </EmptyState>
    );
  if (jobId && job.data && !["draft", "open"].includes(job.data.job.status))
    return (
      <EmptyState title="This job cannot be edited">
        <Link to={`/employer/jobs/${jobId}`}>
          Return to the job to view its current lifecycle actions.
        </Link>
      </EmptyState>
    );
  if (
    jobId &&
    job.data &&
    !companies.data.companies.some((c) => c.id === job.data.job.company.id)
  )
    return (
      <EmptyState title="Company membership required">
        You do not have access to edit this job.
      </EmptyState>
    );
  return (
    <>
      <PageHeader
        title={jobId ? "Edit job" : "Create a job"}
        description={
          jobId
            ? "Published changes are recorded in candidate-visible history."
            : "Start with a structured draft. Review it before publishing."
        }
      />
      <JobEditor
        key={jobId ?? "new"}
        job={jobId ? job.data?.job : undefined}
        companies={companies.data.companies}
      />
    </>
  );
}
function JobEditor({ job, companies }: { job?: Job; companies: Company[] }) {
  const navigate = useNavigate();
  const benefits = useApiQuery(["benefits"], api.benefits);
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      companyId: job?.company.id ?? companies[0].id,
      title: job?.title ?? "",
      description: job?.description ?? "",
      employmentType: job?.employmentType ?? "full_time",
      workMode: job?.workMode ?? "remote",
      city: job?.location.city ?? "",
      state: job?.location.state ?? "",
      country: job?.location.country ?? "India",
      experienceMin: job?.experience.min ?? 0,
      experienceMax: job?.experience.max ?? 0,
      salaryMin: job?.salary.min ?? 0,
      salaryMax: job?.salary.max ?? 0,
      salaryCurrency: job?.salary.currency ?? "INR",
      salaryPeriod:
        (job?.salary.period as JobFormValues["salaryPeriod"]) ?? "yearly",
      openings: job?.openings ?? 1,
      applicationDeadline: job ? platformInput(job.applicationDeadline) : "",
      decisionDeadline: job ? platformInput(job.decisionDeadline) : "",
      requiredSkillIds: job?.requiredSkills.map((s) => s.id) ?? [],
      preferredSkillIds: job?.preferredSkills.map((s) => s.id) ?? [],
      benefitIds: job?.benefits.map((b) => b.id) ?? [],
    },
  });
  const mutation = useApiMutation(
    async (values: JobFormValues) => {
      const body = {
        ...values,
        salaryCurrency: values.salaryCurrency.toUpperCase(),
        applicationDeadline:
          job &&
          values.applicationDeadline === platformInput(job.applicationDeadline)
            ? job.applicationDeadline
            : platformIso(values.applicationDeadline),
        decisionDeadline:
          job && values.decisionDeadline === platformInput(job.decisionDeadline)
            ? job.decisionDeadline
            : platformIso(values.decisionDeadline),
      };
      if (job) {
        const { companyId: _companyId, ...patch } = body;
        await api.updateJob(job.id, patch);
        return { job: { id: job.id } };
      }
      return api.createJob(body);
    },
    ["employer-jobs", "job", "application", "obligations"],
  );
  const e = form.formState.errors;
  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        if (
          job?.status === "open" &&
          new Date(platformIso(values.applicationDeadline)).getTime() <=
            Date.now()
        ) {
          form.setError("applicationDeadline", {
            message:
              "The API requires future intake when editing an open job. Update this deadline to continue.",
          });
          return;
        }
        mutation.mutate(values, {
          onSuccess: (result) => navigate(`/employer/jobs/${result.job.id}`),
        });
      })}
    >
      <div className="grid-two">
        <div>
          <section className="panel">
            <h2>Role details</h2>
            <Field label="Company" error={e.companyId?.message}>
              <select {...form.register("companyId")} disabled={!!job}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job title" error={e.title?.message}>
              <input {...form.register("title")} />
            </Field>
            <Field label="Description" error={e.description?.message}>
              <textarea rows={8} {...form.register("description")} />
            </Field>
            <div className="form-grid">
              <Field label="Employment type" error={e.employmentType?.message}>
                <select {...form.register("employmentType")}>
                  {["full_time", "part_time", "contract", "internship"].map(
                    (x) => (
                      <option key={x} value={x}>
                        {label(x)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Work mode" error={e.workMode?.message}>
                <select {...form.register("workMode")}>
                  {["remote", "hybrid", "onsite"].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </Field>
              {(["city", "state", "country"] as const).map((key) => (
                <Field key={key} label={label(key)} error={e[key]?.message}>
                  <input {...form.register(key)} />
                </Field>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Skills & benefits</h2>
            <Controller
              control={form.control}
              name="requiredSkillIds"
              render={({ field, fieldState }) => (
                <SkillPicker
                  label="Required skills"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  initialItems={job?.requiredSkills}
                />
              )}
            />
            <Controller
              control={form.control}
              name="preferredSkillIds"
              render={({ field, fieldState }) => (
                <SkillPicker
                  label="Preferred skills"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  initialItems={job?.preferredSkills}
                />
              )}
            />
            <fieldset>
              <legend>Benefits</legend>
              {benefits.isPending ? (
                <LoadingState />
              ) : benefits.error ? (
                <ErrorState
                  error={benefits.error}
                  retry={() => void benefits.refetch()}
                />
              ) : (
                benefits.data.benefits.map((benefit) => (
                  <label className="check-option" key={benefit.id}>
                    <input
                      type="checkbox"
                      value={benefit.id}
                      {...form.register("benefitIds")}
                    />
                    {benefit.name}
                  </label>
                ))
              )}
            </fieldset>
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>Experience & compensation</h2>
            <div className="form-grid">
              {(
                [
                  "experienceMin",
                  "experienceMax",
                  "salaryMin",
                  "salaryMax",
                  "openings",
                ] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      experienceMin: "Minimum experience (years)",
                      experienceMax: "Maximum experience (years)",
                      salaryMin: "Minimum salary",
                      salaryMax: "Maximum salary",
                      openings: "Openings",
                    }[key]
                  }
                  error={e[key]?.message}
                >
                  <input
                    type="number"
                    min={key === "openings" ? 1 : 0}
                    step={key.startsWith("experience") ? "0.1" : "1"}
                    {...form.register(key, { valueAsNumber: true })}
                  />
                </Field>
              ))}
              <Field label="Currency" error={e.salaryCurrency?.message}>
                <input maxLength={3} {...form.register("salaryCurrency")} />
              </Field>
              <Field label="Salary period" error={e.salaryPeriod?.message}>
                <select {...form.register("salaryPeriod")}>
                  {["yearly", "monthly", "hourly"].map((x) => (
                    <option value={x} key={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section className="panel">
            <h2>Deadline commitments</h2>
            <p className="notice small">
              Enter times in Asia/Kolkata (IST, UTC+05:30). They are sent to the
              API as UTC timestamps.
            </p>
            <Field
              label="Application deadline · IST"
              error={e.applicationDeadline?.message}
            >
              <input
                type="datetime-local"
                {...form.register("applicationDeadline")}
              />
            </Field>
            <Field
              label="Decision deadline · IST"
              error={e.decisionDeadline?.message}
            >
              <input
                type="datetime-local"
                {...form.register("decisionDeadline")}
              />
            </Field>
            <p className="small muted">
              The decision date must follow the application date. Both become
              visible to candidates.
            </p>
          </section>
          <ErrorSummary error={mutation.error} />
          <div className="actions">
            <PendingButton
              disabled={
                mutation.isPending || benefits.isPending || !!benefits.error
              }
              pending={mutation.isPending}
              pendingText={job ? "Saving changes…" : "Creating draft…"}
            >
              {mutation.isPending
                ? "Saving…"
                : job
                  ? "Save changes"
                  : "Create draft"}
            </PendingButton>
            <Link
              className="button secondary"
              to={job ? `/employer/jobs/${job.id}` : "/employer/jobs"}
            >
              Cancel
            </Link>
          </div>
        </aside>
      </div>
    </form>
  );
}
function ErrorSummary({ error }: { error: unknown }) {
  return error ? <ErrorState error={error} /> : null;
}
