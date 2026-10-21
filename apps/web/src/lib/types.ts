export type Role = "candidate" | "employer";
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
}
export type JobStatus =
  | "draft"
  | "open"
  | "applications_closed"
  | "hiring_in_progress"
  | "filled"
  | "cancelled";
export type ApplicationStatus =
  | "applied"
  | "under_review"
  | "shortlisted"
  | "interview"
  | "final_review"
  | "offer"
  | "offer_accepted"
  | "offer_declined"
  | "rejected"
  | "withdrawn"
  | "job_cancelled";
export interface Named {
  id: string;
  name: string;
}
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Company extends Named {
  website: string | null;
  description: string | null;
  membershipRole?: "owner" | "recruiter";
  createdAt: string;
  updatedAt: string;
}
export interface JobSummary {
  id: string;
  title: string;
  company: Named;
  status?: JobStatus;
  openings: number;
  workMode: "remote" | "hybrid" | "onsite";
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  location: { city: string | null; state: string | null; country: string };
  experience: { min: number; max: number };
  salary: { min: number; max: number; currency: string; period: string };
  applicationDeadline: string;
  decisionDeadline: string;
  decisionDeadlineMissedAt: string | null;
  createdAt: string;
}
export interface Job extends Omit<JobSummary, "decisionDeadlineMissedAt"> {
  status: JobStatus;
  description: string;
  company: Pick<Company, "id" | "name" | "website" | "description">;
  requiredSkills: Named[];
  preferredSkills: Named[];
  benefits: Named[];
  accountability: {
    decisionDeadlineMissed: boolean;
    decisionDeadlineMissedAt: string | null;
    candidatesAwaitingOutcome: number;
  };
  applicationsClosedAt: string | null;
  applicationsClosedBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  parentJobId: string | null;
  updatedAt: string;
  statusHistory: {
    fromStatus: JobStatus | null;
    toStatus: JobStatus;
    source: string;
    note: string | null;
    createdAt: string;
  }[];
  changeHistory: {
    fieldName: string;
    oldValue: unknown;
    newValue: unknown;
    changedAt: string;
  }[];
}
export interface EmployerJob {
  id: string;
  title: string;
  company: Named;
  status: JobStatus;
  openings: number;
  applicationCount: number;
  applicationDeadline: string;
  decisionDeadline: string;
  decisionDeadlineMissedAt: string | null;
  updatedAt: string;
}
export interface SavedJob {
  id: string;
  title: string;
  status: JobStatus;
  company: Named;
  applicationDeadline: string;
  decisionDeadline: string;
  savedAt: string;
}
export interface Application {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    status: JobStatus;
    company: Named;
    applicationDeadline: string;
    decisionDeadline: string;
  };
}
export interface Interview {
  id: string;
  scheduledAt: string;
  mode: "video" | "phone" | "onsite";
  meetingLink: string | null;
  location: string | null;
  notes: string | null;
  status: "scheduled" | "cancelled";
  cancelledAt: string | null;
}
export interface ApplicationDetail extends Application {
  timeline: {
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string | null;
    createdAt: string;
  }[];
  interviews: Interview[];
  candidate?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile: Profile | null;
  };
  resume?: Resume | null;
}
export interface Profile {
  headline: string | null;
  summary: string | null;
  totalExperience: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  skills: Named[];
  updatedAt: string;
}
export interface Resume {
  id: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  jobId: string | null;
  applicationId: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface Applicant {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  candidate: { id: string; firstName: string; lastName: string; email: string };
}
export interface Obligation {
  applicationId: string;
  status: ApplicationStatus;
  candidate: Applicant["candidate"];
  job: {
    id: string;
    title: string;
    company: Named;
    decisionDeadline: string;
    decisionDeadlineMissedAt: string;
  };
  updatedAt: string;
}
