import { http, searchQuery, downloadFile } from "./api-client";
import type {
  User,
  Applicant,
  Application,
  ApplicationDetail,
  Company,
  EmployerJob,
  Job,
  JobSummary,
  Named,
  Notification,
  Obligation,
  PaginationInfo,
  Profile,
  Resume,
  SavedJob,
} from "./types";
type Params = URLSearchParams | Record<string, string | number | undefined>;
type Page<K extends string, T> = { pagination: PaginationInfo } & Record<
  K,
  T[]
>;
export const api = {
  updateCurrentUser: (body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
  }) => http.send<{ user: User }>("/auth/current-user", "PATCH", body),
  jobs: (params: Params, signal?: AbortSignal) =>
    http.get<Page<"jobs", JobSummary>>("/jobs" + searchQuery(params), signal),
  job: (id: string, signal?: AbortSignal) =>
    http.get<{ job: Job }>(`/jobs/${id}`, signal),
  applications: (signal?: AbortSignal) =>
    http.get<{ applications: Application[] }>("/applications/me", signal),
  application: (id: string, employer: boolean, signal?: AbortSignal) =>
    http.get<{ application: ApplicationDetail }>(
      `${employer ? "/employer" : ""}/applications/${id}`,
      signal,
    ),
  apply: (id: string) =>
    http.send<{ application: { id: string } }>(`/jobs/${id}/apply`, "POST"),
  withdraw: (id: string) => http.send(`/applications/${id}/withdraw`, "PATCH"),
  offerResponse: (id: string, response: "offer_accepted" | "offer_declined") =>
    http.send(`/applications/${id}/offer-response`, "PATCH", { response }),
  saved: (page: number, signal?: AbortSignal) =>
    http.get<Page<"jobs", SavedJob>>(
      `/candidate/saved-jobs?page=${page}&limit=20`,
      signal,
    ),
  save: (id: string) => http.send(`/candidate/saved-jobs/${id}`, "PUT"),
  unsave: (id: string) => http.send(`/candidate/saved-jobs/${id}`, "DELETE"),
  profile: (signal?: AbortSignal) =>
    http.get<{ profile: Profile | null }>("/candidate/profile", signal),
  updateProfile: (body: unknown) =>
    http.send("/candidate/profile", "PATCH", body),
  resume: (signal?: AbortSignal) =>
    http.get<{ resume: Resume | null }>("/candidate/resume", signal),
  uploadResume: (file: File) =>
    http.send("/candidate/resume", "PUT", file, {
      raw: true,
      headers: { "Content-Type": "application/pdf", "X-File-Name": file.name },
    }),
  deleteResume: () => http.send("/candidate/resume", "DELETE"),
  downloadResume: (filename: string, applicationId?: string) =>
    downloadFile(
      applicationId
        ? `/employer/applications/${applicationId}/resume`
        : "/candidate/resume/download",
      filename,
    ),
  notifications: (page: number, signal?: AbortSignal) =>
    http.get<Page<"notifications", Notification>>(
      `/notifications?page=${page}&limit=20`,
      signal,
    ),
  readNotification: (id: string) =>
    http.send(`/notifications/${id}/read`, "PATCH"),
  skills: (search = "", signal?: AbortSignal) =>
    http.get<{ skills: Named[] }>("/skills" + searchQuery({ search }), signal),
  benefits: (signal?: AbortSignal) =>
    http.get<{ benefits: Named[] }>("/benefits", signal),
  companies: (signal?: AbortSignal) =>
    http.get<{ companies: Company[] }>("/companies", signal),
  company: (id: string, signal?: AbortSignal) =>
    http.get<{ company: Company }>(`/companies/${id}`, signal),
  createCompany: (body: unknown) =>
    http.send<{ company: Company }>("/companies", "POST", body),
  updateCompany: (id: string, body: unknown) =>
    http.send(`/companies/${id}`, "PATCH", body),
  members: (id: string, signal?: AbortSignal) =>
    http.get<{
      members: {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
      }[];
    }>(`/companies/${id}/members`, signal),
  addMember: (id: string, userId: string) =>
    http.send(`/companies/${id}/members`, "POST", { userId }),
  employerJobs: (params: Params, signal?: AbortSignal) =>
    http.get<Page<"jobs", EmployerJob>>(
      "/employer/jobs" + searchQuery(params),
      signal,
    ),
  createJob: (body: unknown) =>
    http.send<{ job: { id: string } }>("/jobs", "POST", body),
  updateJob: (id: string, body: unknown) =>
    http.send(`/jobs/${id}`, "PATCH", body),
  publish: (id: string) => http.send(`/jobs/${id}/publish`, "PATCH"),
  jobStatus: (id: string, status: string) =>
    http.send(`/employer/jobs/${id}/status`, "PATCH", { status }),
  cancelJob: (id: string, reason: string) =>
    http.send(`/employer/jobs/${id}/cancel`, "PATCH", { reason }),
  repost: (id: string, body: unknown) =>
    http.send<{ job: { id: string } }>(
      `/employer/jobs/${id}/repost`,
      "POST",
      body,
    ),
  applicants: (id: string, params: Params, signal?: AbortSignal) =>
    http.get<Page<"applications", Applicant>>(
      `/employer/jobs/${id}/applications` + searchQuery(params),
      signal,
    ),
  applicationStatus: (id: string, status: string, note?: string) =>
    http.send(`/employer/applications/${id}/status`, "PATCH", {
      status,
      ...(note ? { note } : {}),
    }),
  scheduleInterview: (id: string, body: unknown) =>
    http.send(`/employer/applications/${id}/interviews`, "POST", body),
  rescheduleInterview: (id: string, body: unknown) =>
    http.send(`/employer/interviews/${id}`, "PATCH", body),
  cancelInterview: (id: string) =>
    http.send(`/employer/interviews/${id}/cancel`, "PATCH"),
  obligations: (signal?: AbortSignal) =>
    http.get<{ overdueCount: number; obligations: Obligation[] }>(
      "/employer/feedback-obligations",
      signal,
    ),
};
export async function allSavedJobs(signal: AbortSignal) {
  const result = await api.saved(1, signal);
  const jobs = [...result.jobs];
  for (let page = 2; page <= result.pagination.totalPages; page++)
    jobs.push(...(await api.saved(page, signal)).jobs);
  return jobs;
}
