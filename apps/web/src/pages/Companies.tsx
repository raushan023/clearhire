import {
  PendingButton,
  EmptyState,
  ErrorState,
  Feedback,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "../components/ui";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { useApiMutation, useApiQuery } from "../lib/query";
import type { Company } from "../lib/types";
const companySchema = z.object({
  name: z.string().trim().min(2).max(150),
  website: z.union([z.url().max(255), z.literal("")]),
  description: z.string().trim().max(2000),
});
export function CompaniesPage() {
  const { user } = useAuth();
  const query = useApiQuery(["companies"], api.companies),
    navigate = useNavigate();
  const create = useApiMutation(api.createCompany, ["companies"]);
  return (
    <>
      <PageHeader
        title="Your companies"
        description="Company workspaces keep your postings, members, and applications together."
      />
      <p className="notice small">
        To join another company, share your employer ID with its owner:{" "}
        <code className="reference">{user!.id}</code>
      </p>
      <div className="grid-two">
        <section>
          {query.isPending ? (
            <LoadingState />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : query.data.companies.length ? (
            query.data.companies.map((company) => (
              <article key={company.id} className="panel list-row">
                <div>
                  <h2>
                    <Link to={`/employer/companies/${company.id}`}>
                      {company.name}
                    </Link>
                  </h2>
                  <p className="muted small">
                    {company.description || "No description provided."}
                  </p>
                </div>
                <StatusBadge status={company.membershipRole ?? "member"} />
              </article>
            ))
          ) : (
            <EmptyState title="Create your first company">
              A company workspace is required before you can create a job.
            </EmptyState>
          )}
        </section>
        <aside className="panel">
          <h2>Create a company</h2>
          <CompanyForm
            onSubmit={(values) =>
              create.mutate(
                {
                  name: values.name,
                  ...(values.website ? { website: values.website } : {}),
                  ...(values.description
                    ? { description: values.description }
                    : {}),
                },
                {
                  onSuccess: (result) =>
                    navigate(`/employer/companies/${result.company.id}`),
                },
              )
            }
            pending={create.isPending}
            error={create.error}
          />
        </aside>
      </div>
    </>
  );
}
function CompanyForm({
  company,
  pending,
  error,
  onSubmit,
  success,
}: {
  company?: Company;
  pending: boolean;
  error: unknown;
  onSubmit: (values: z.infer<typeof companySchema>) => void;
  success?: boolean;
}) {
  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      website: company?.website ?? "",
      description: company?.description ?? "",
    },
  });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Company name" error={form.formState.errors.name?.message}>
        <input {...form.register("name")} />
      </Field>
      <Field label="Website" error={form.formState.errors.website?.message}>
        <input
          type="url"
          {...form.register("website")}
          placeholder="https://example.com"
        />
      </Field>
      <Field
        label="Description"
        error={form.formState.errors.description?.message}
      >
        <textarea {...form.register("description")} />
      </Field>
      <Feedback
        error={error}
        success={success ? "Company updated." : undefined}
      />
      <PendingButton disabled={pending} pending={pending} pendingText="Saving…">
        {pending ? "Saving…" : company ? "Save company" : "Create company"}
      </PendingButton>
    </form>
  );
}
export function CompanyPage() {
  const { user } = useAuth();
  const { companyId = "" } = useParams();
  const query = useApiQuery(["company", companyId], (signal) =>
    api.company(companyId, signal),
  );
  const members = useApiQuery(["members", companyId], (signal) =>
    api.members(companyId, signal),
  );
  const update = useApiMutation(
    (body: unknown) => api.updateCompany(companyId, body),
    ["companies", "company", "employer-jobs", "job"],
  );
  const add = useApiMutation(
    (userId: string) => api.addMember(companyId, userId),
    ["members"],
  );
  const form = useForm<{ userId: string }>({
    resolver: zodResolver(
      z.object({ userId: z.uuid("Enter the existing employer’s user ID.") }),
    ),
    defaultValues: { userId: "" },
  });
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const company = query.data.company,
    owner = company.membershipRole === "owner";
  return (
    <>
      <PageHeader
        title={company.name}
        description={`Your role: ${company.membershipRole}`}
        actions={
          <Link
            className="button secondary"
            to={`/employer/jobs?companyId=${companyId}`}
          >
            Company jobs
          </Link>
        }
      />
      <div className="grid-two">
        <section className="panel">
          <h2>Company details</h2>
          {owner ? (
            <CompanyForm
              company={company}
              pending={update.isPending}
              error={update.error}
              success={update.isSuccess}
              onSubmit={(values) =>
                update.mutate({
                  ...values,
                  website: values.website || null,
                  description: values.description || null,
                })
              }
            />
          ) : (
            <>
              <p className="preserve">
                {company.description || "No description provided."}
              </p>
              <p>{company.website}</p>
              <p className="notice">
                Recruiters can manage hiring. Only the owner can edit company
                details or add members.
              </p>
            </>
          )}
        </section>
        <section className="panel">
          <h2>Members</h2>
          {members.isPending ? (
            <LoadingState />
          ) : members.error ? (
            <ErrorState
              error={members.error}
              retry={() => void members.refetch()}
            />
          ) : (
            <ul className="member-list">
              {members.data.members.map((member) => (
                <li key={member.userId}>
                  <div>
                    <strong>
                      {member.userId === user!.id ? user!.firstName : member.firstName}{" "}
                      {member.userId === user!.id ? user!.lastName : member.lastName}
                    </strong>
                    <p className="muted small">
                      {member.userId === user!.id ? user!.email : member.email}
                    </p>
                  </div>
                  <StatusBadge status={member.role} />
                </li>
              ))}
            </ul>
          )}
          {owner && (
            <form
              onSubmit={form.handleSubmit((values) =>
                add.mutate(values.userId, { onSuccess: () => form.reset() }),
              )}
            >
              <h3>Add an existing employer</h3>
              <Field
                label="Employer user ID"
                error={form.formState.errors.userId?.message}
              >
                <input
                  {...form.register("userId")}
                  placeholder="UUID of an existing employer"
                />
              </Field>
              <p className="small muted">
                This adds a recruiter. Invitation emails and member removal are
                not supported.
              </p>
              <Feedback
                error={add.error}
                success={add.isSuccess ? "Recruiter added." : undefined}
              />
              <PendingButton
                disabled={add.isPending}
                pending={add.isPending}
                pendingText="Adding recruiter…"
              >
                {add.isPending ? "Adding…" : "Add recruiter"}
              </PendingButton>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
