import assert from "node:assert/strict";
import test from "node:test";
import {
  cancellationSchema,
  interviewSchema,
  jobFormSchema,
  repostSchema,
} from "../src/lib/forms";
import {
  platformInput,
  platformIso,
  validPlatformDate,
  safeUrl,
} from "../src/lib/presentation";
const fixture = {
  companyId: "11111111-1111-4111-8111-111111111111",
  title: "Backend engineer",
  description: "Build transparent and reliable hiring systems.",
  employmentType: "full_time",
  workMode: "remote",
  city: "",
  state: "",
  country: "India",
  experienceMin: 1,
  experienceMax: 4,
  salaryMin: 100,
  salaryMax: 200,
  salaryCurrency: "INR",
  salaryPeriod: "yearly",
  openings: 2,
  applicationDeadline: "2099-12-01T18:00",
  decisionDeadline: "2099-12-02T18:00",
  requiredSkillIds: ["22222222-2222-4222-8222-222222222222"],
  preferredSkillIds: [],
  benefitIds: [],
};
test("job form validates ranges, canonical required skills, overlap, and deadline order", () => {
  assert.equal(jobFormSchema.safeParse(fixture).success, true);
  for (const patch of [
    { experienceMax: 0 },
    { salaryMax: 0 },
    { requiredSkillIds: [] },
    { requiredSkillIds: ["free text"] },
    { preferredSkillIds: fixture.requiredSkillIds },
    { decisionDeadline: "2099-11-30T18:00" },
    { openings: 0 },
  ])
    assert.equal(
      jobFormSchema.safeParse({ ...fixture, ...patch }).success,
      false,
    );
});
test("deadline input preserves Asia/Kolkata instants and rejects overflow dates", () => {
  assert.equal(platformIso("2026-10-16T18:30"), "2026-10-16T13:00:00.000Z");
  assert.equal(platformInput("2026-10-16T13:00:00.000Z"), "2026-10-16T18:30");
  assert.equal(platformInput("2026-10-16T20:00:00.000Z"), "2026-10-17T01:30");
  assert.equal(validPlatformDate("2026-02-31T12:00"), false);
  assert.equal(validPlatformDate("not a date"), false);
});
test("cancellation and repost forms enforce meaningful reason and new ordered deadlines", () => {
  assert.equal(
    cancellationSchema.safeParse({ reason: "short" }).success,
    false,
  );
  assert.equal(
    cancellationSchema.safeParse({
      reason: "The hiring requirement was withdrawn.",
    }).success,
    true,
  );
  assert.equal(
    repostSchema.safeParse({
      applicationDeadline: "2000-01-01T12:00",
      decisionDeadline: "2000-01-02T12:00",
    }).success,
    false,
  );
  assert.equal(repostSchema.safeParse(fixture).success, true);
});
test("interview forms require mode-specific details and a future time", () => {
  const values = {
    scheduledAt: "2099-12-01T12:00",
    mode: "phone",
    meetingLink: "",
    location: "",
    notes: "",
  };
  assert.equal(interviewSchema.safeParse(values).success, true);
  assert.equal(
    interviewSchema.safeParse({ ...values, mode: "video" }).success,
    false,
  );
  assert.equal(
    interviewSchema.safeParse({ ...values, mode: "onsite" }).success,
    false,
  );
  assert.equal(
    interviewSchema.safeParse({ ...values, scheduledAt: "2000-01-01T12:00" })
      .success,
    false,
  );
});
test("external links reject script and data URL schemes", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("data:text/html,test"), undefined);
  assert.equal(
    safeUrl("https://example.com/meeting"),
    "https://example.com/meeting",
  );
});
