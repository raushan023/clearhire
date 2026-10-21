import type { ApplicationStatus, JobStatus } from "./types";
export const jobStatuses: JobStatus[] = [
  "draft",
  "open",
  "applications_closed",
  "hiring_in_progress",
  "filled",
  "cancelled",
];
export const applicationStatuses: ApplicationStatus[] = [
  "applied",
  "under_review",
  "shortlisted",
  "interview",
  "final_review",
  "offer",
  "offer_accepted",
  "offer_declined",
  "rejected",
  "withdrawn",
  "job_cancelled",
];
// Presentation hints mirror currently supported actions. The API authorizes and
// revalidates every mutation, including capacity and concurrency conflicts.
export function jobActions(status: JobStatus): string[] {
  return {
    draft: ["edit", "publish"],
    open: ["edit", "applications_closed", "cancel"],
    applications_closed: ["hiring_in_progress", "cancel"],
    hiring_in_progress: ["filled", "cancel"],
    filled: ["repost"],
    cancelled: ["repost"],
  }[status];
}
export function employerTransitions(
  status: ApplicationStatus,
): ApplicationStatus[] {
  const steps: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
    applied: ["under_review", "rejected"],
    under_review: ["shortlisted", "rejected"],
    shortlisted: ["interview", "rejected"],
    interview: ["final_review", "rejected"],
    final_review: ["offer", "rejected"],
  };
  return steps[status] ?? [];
}
export const canWithdraw = (status: ApplicationStatus) =>
  [
    "applied",
    "under_review",
    "shortlisted",
    "interview",
    "final_review",
  ].includes(status);
export const canRespondToOffer = (status: ApplicationStatus) =>
  status === "offer";
export const canApply = (
  status: JobStatus,
  deadline: string,
  alreadyApplied: boolean,
  now = Date.now(),
) => status === "open" && new Date(deadline).getTime() > now && !alreadyApplied;
export const isUnresolved = (status: ApplicationStatus) =>
  canWithdraw(status) || status === "offer";
export function dateTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Not provided";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export const viewerTimezone = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone === "Asia/Calcutta" ? "Asia/Kolkata" : zone;
};
// Asia/Kolkata has a fixed +05:30 offset. Forms explicitly label this timezone;
// display timestamps use the viewer's local timezone and show its name.
export function platformInput(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function platformIso(input: string): string {
  return new Date(`${input}:00+05:30`).toISOString();
}
export const validPlatformDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(`${value}:00+05:30`);
  return (
    Number.isFinite(date.getTime()) &&
    platformInput(date.toISOString()) === value
  );
};
export function money(
  min: number,
  max: number,
  currency: string,
  period: string,
) {
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  return `${currency} ${format.format(min)}–${format.format(max)} / ${period}`;
}
export function safeUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function urlPage(params: URLSearchParams) {
  const value = Number(params.get("page"));
  return Number.isInteger(value) && value > 0 && value <= 1000000 ? value : 1;
}
