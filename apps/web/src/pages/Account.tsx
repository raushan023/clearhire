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
} from "../components/ui";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApiMutation, useApiQuery } from "../lib/query";
import { dateTime, urlPage } from "../lib/presentation";
import type { Profile } from "../lib/types";
import { ContactDetails } from "../components/ContactDetails";
import { SkillPicker } from "../components/SkillPicker";
const profileSchema = z.object({
  headline: z.string().trim().max(150),
  summary: z.string().trim().max(4000),
  totalExperience: z.number().min(0).max(999.9).multipleOf(0.1).nullable(),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
  country: z.string().trim().max(100),
  currentCompany: z.string().trim().max(150),
  currentTitle: z.string().trim().max(150),
  skillIds: z.array(z.uuid()).max(100),
});
type ProfileValues = z.infer<typeof profileSchema>;
export function ProfilePage() {
  const query = useApiQuery(["profile"], api.profile);
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Give employers a clear picture of your experience and skills."
      />
      <ContactDetails />
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ProfileForm profile={query.data.profile} />
      )}
    </>
  );
}
function ProfileForm({ profile }: { profile: Profile | null }) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      headline: profile?.headline ?? "",
      summary: profile?.summary ?? "",
      totalExperience: profile?.totalExperience ?? null,
      city: profile?.city ?? "",
      state: profile?.state ?? "",
      country: profile?.country ?? "",
      currentCompany: profile?.currentCompany ?? "",
      currentTitle: profile?.currentTitle ?? "",
      skillIds: profile?.skills.map((s) => s.id) ?? [],
    },
  });
  const mutation = useApiMutation(api.updateProfile, ["profile"]);
  return (
    <div className="grid-two">
      <form
        className="panel"
        onSubmit={form.handleSubmit((values) => {
          const body = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [
              key,
              typeof value === "string" ? value || null : value,
            ]),
          );
          mutation.mutate(body, { onSuccess: () => form.reset(values) });
        })}
      >
        <h2>Professional profile</h2>
        <Field label="Headline" error={form.formState.errors.headline?.message}>
          <input
            {...form.register("headline")}
            placeholder="e.g. Backend engineer · 4 years in payments"
          />
        </Field>
        <Field label="Summary" error={form.formState.errors.summary?.message}>
          <textarea rows={5} {...form.register("summary")} />
        </Field>
        <div className="form-grid">
          <Field
            label="Total experience (years)"
            error={form.formState.errors.totalExperience?.message}
          >
            <input
              type="number"
              min="0"
              max="999.9"
              step="0.1"
              {...form.register("totalExperience", {
                setValueAs: (value) => (value === "" ? null : Number(value)),
              })}
            />
          </Field>
          {(
            [
              "currentTitle",
              "currentCompany",
              "city",
              "state",
              "country",
            ] as const
          ).map((key) => (
            <Field
              key={key}
              label={
                key === "currentTitle"
                  ? "Current title"
                  : key === "currentCompany"
                    ? "Current company"
                    : key.charAt(0).toUpperCase() + key.slice(1)
              }
              error={form.formState.errors[key]?.message}
            >
              <input {...form.register(key)} />
            </Field>
          ))}
        </div>
        <Controller
          control={form.control}
          name="skillIds"
          render={({ field, fieldState }) => (
            <SkillPicker
              label="Skills"
              value={field.value}
              onChange={field.onChange}
              initialItems={profile?.skills}
              error={fieldState.error?.message}
            />
          )}
        />
        <Feedback
          error={mutation.error}
          success={mutation.isSuccess ? "Profile saved." : undefined}
        />
        <PendingButton
          disabled={mutation.isPending}
          pending={mutation.isPending}
          pendingText="Saving…"
        >
          {mutation.isPending ? "Saving…" : "Save professional profile"}
        </PendingButton>
      </form>
      <aside className="panel">
        <h2>Your information, in context</h2>
        <p className="muted">
          Company members can read your current profile and resume while your
          application is unresolved. Resolved applications no longer provide
          live profile or resume access.
        </p>
        <p className="small muted">
          Your active applications see later updates. Profiles and resumes are
          not snapshots from the day you applied.
        </p>
        <Link to="/candidate/resume">Manage your resume →</Link>
      </aside>
    </div>
  );
}
export function ResumePage() {
  const query = useApiQuery(["resume"], api.resume),
    [file, setFile] = useState<File | null>(null),
    [validation, setValidation] = useState(""),
    [confirm, setConfirm] = useState<"replace" | "delete" | null>(null),
    [inputKey, setInputKey] = useState(0);
  const upload = useApiMutation(api.uploadResume, ["resume"]);
  const remove = useApiMutation(api.deleteResume, ["resume"]);
  const download = useApiMutation(
    async (filename: string) => api.downloadResume(filename),
    [],
  );
  const resume = query.data?.resume;
  return (
    <>
      <PageHeader
        title="Your resume"
        description="One active PDF, shared privately through eligible applications."
      />
      <div className="grid-two">
        <div>
          {query.isPending ? (
            <LoadingState />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : resume ? (
            <section className="panel">
              <p className="eyebrow">CURRENT RESUME</p>
              <h2>{resume.filename}</h2>
              <p className="muted">
                {Math.ceil(resume.sizeBytes / 1024)} KB · Updated{" "}
                {dateTime(resume.updatedAt)}
              </p>
              <div className="actions">
                <PendingButton
                  className="secondary"
                  disabled={download.isPending}
                  pending={download.isPending}
                  pendingText="Downloading…"
                  onClick={() => download.mutate(resume.filename)}
                >
                  Download PDF
                </PendingButton>
                <PendingButton
                  className="secondary"
                  disabled={remove.isPending}
                  pending={remove.isPending}
                  pendingText="Saving…"
                  onClick={() => {
                    remove.reset();
                    setConfirm("delete");
                  }}
                >
                  Delete resume
                </PendingButton>
              </div>
            </section>
          ) : (
            <EmptyState title="No resume uploaded">
              Add a PDF when resume storage is available.
            </EmptyState>
          )}
          <form
            className="panel"
            onSubmit={(event) => {
              event.preventDefault();
              setValidation("");
              upload.reset();
              if (!file) {
                setValidation("Choose a PDF to upload.");
                return;
              }
              if (
                (file.type && file.type !== "application/pdf") ||
                !/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,145}\.pdf$/i.test(file.name) ||
                file.size < 1 ||
                file.size > 5 * 1024 * 1024
              ) {
                setValidation(
                  "Choose a nonempty PDF up to 5 MiB with a simple filename ending in .pdf (up to 150 characters).",
                );
                return;
              }
              setConfirm("replace");
            }}
          >
            <h2>{resume ? "Replace your resume" : "Upload your resume"}</h2>
            <Field label="PDF file (maximum 5 MiB)" error={validation}>
              <input
                key={inputKey}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <p className="small muted">
              Replacement updates the resume available through all unresolved
              applications.
            </p>
            <PendingButton
              disabled={upload.isPending || query.isPending || !!query.error}
              pending={upload.isPending}
              pendingText="Saving…"
            >
              Review upload
            </PendingButton>
          </form>
          <Feedback
            error={upload.error ?? remove.error ?? download.error}
            success={
              upload.isSuccess
                ? "Resume uploaded."
                : remove.isSuccess
                  ? "Resume deleted."
                  : undefined
            }
          />
        </div>
        <aside className="panel">
          <h2>Private by default</h2>
          <p className="muted">
            Storage availability is managed by this environment. If private
            storage is unavailable, uploads and downloads show an explicit
            error. No upload success is claimed until the API confirms it.
          </p>
          <p className="small muted">
            PDF validation also runs on the server. Replacing your resume does
            not preserve an application-time copy.
          </p>
        </aside>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm === "delete"
            ? "Delete your active resume?"
            : resume
              ? "Replace your active resume?"
              : "Upload this resume?"
        }
        action={confirm === "delete" ? "Delete resume" : "Upload PDF"}
        pending={upload.isPending || remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "delete")
            remove.mutate(undefined, { onSuccess: () => setConfirm(null) });
          else if (file)
            upload.mutate(file, {
              onSuccess: () => {
                setConfirm(null);
                setFile(null);
                setInputKey((k) => k + 1);
              },
            });
        }}
      >
        <p>
          {confirm === "delete"
            ? "Your active resume will no longer be available to you or eligible employers."
            : `File: ${file?.name}. ${resume ? "The previous active file will be replaced." : ""}`}
        </p>
        {(upload.error ?? remove.error) && (
          <ErrorState error={upload.error ?? remove.error} />
        )}
      </ConfirmDialog>
    </>
  );
}
export function NotificationsPage() {
  const { user } = useAuth(),
    [params, setParams] = useSearchParams(),
    page = urlPage(params);
  const query = useApiQuery(["notifications", page], (signal) =>
    api.notifications(page, signal),
  );
  const read = useApiMutation(api.readNotification, [
    "notifications",
    "unread",
  ]);
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Application updates, interview changes, and hiring commitments."
      />
      <Feedback error={read.error} />
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.notifications.length ? (
            query.data.notifications.map((item) => (
              <article
                className={`panel notification ${item.readAt ? "" : "unread"}`}
                key={item.id}
              >
                <div className="list-row">
                  <h2>{item.title}</h2>
                  <span className="small muted">
                    {dateTime(item.createdAt)}
                  </span>
                </div>
                <p className="preserve">{item.message}</p>
                <div className="actions">
                  {item.applicationId ? (
                    <Link
                      to={`/${user!.role}/applications/${item.applicationId}`}
                    >
                      View application →
                    </Link>
                  ) : (
                    item.jobId && (
                      <Link to={`/${user!.role}/jobs/${item.jobId}`}>
                        View job →
                      </Link>
                    )
                  )}
                  {!item.readAt ? (
                    <PendingButton
                      className="secondary small"
                      disabled={read.isPending}
                      pending={read.isPending && read.variables === item.id}
                      pendingText="Marking as read…"
                      onClick={() => read.mutate(item.id)}
                    >
                      Mark as read
                    </PendingButton>
                  ) : (
                    <span className="small muted">Read</span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="You’re all caught up">
              Updates will appear here when something changes.
            </EmptyState>
          )}
          <Pagination
            pending={query.isFetching}
            info={query.data.pagination}
            onPage={(page) => setParams({ page: String(page) })}
          />
        </>
      )}
    </>
  );
}
