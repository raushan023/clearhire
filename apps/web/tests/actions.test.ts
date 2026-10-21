import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationStatuses,
  canApply,
  canRespondToOffer,
  canWithdraw,
  employerTransitions,
  jobActions,
} from "../src/lib/presentation";
test("job actions expose cancellation only during active hiring and repost only for terminal jobs", () => {
  assert.deepEqual(jobActions("draft"), ["edit", "publish"]);
  for (const status of [
    "open",
    "applications_closed",
    "hiring_in_progress",
  ] as const) {
    assert.ok(jobActions(status).includes("cancel"));
    assert.ok(!jobActions(status).includes("repost"));
  }
  for (const status of ["filled", "cancelled"] as const)
    assert.deepEqual(jobActions(status), ["repost"]);
});
test("only pending offers expose response controls and eligible stages expose withdrawal", () => {
  for (const status of applicationStatuses) {
    assert.equal(canRespondToOffer(status), status === "offer");
    if (
      [
        "offer",
        "offer_accepted",
        "offer_declined",
        "rejected",
        "withdrawn",
        "job_cancelled",
      ].includes(status)
    )
      assert.equal(canWithdraw(status), false);
  }
});
test("employer actions never impersonate candidate responses or cancellation outcomes", () => {
  assert.deepEqual(employerTransitions("final_review"), ["offer", "rejected"]);
  for (const status of applicationStatuses)
    assert.ok(
      employerTransitions(status).every(
        (next) =>
          !["offer_accepted", "offer_declined", "job_cancelled"].includes(next),
      ),
    );
  for (const status of [
    "offer",
    "offer_accepted",
    "offer_declined",
    "rejected",
    "withdrawn",
    "job_cancelled",
  ] as const)
    assert.deepEqual(employerTransitions(status), []);
});
test("apply visibility respects status, intake time, and previous applications", () => {
  assert.equal(canApply("open", "2099-01-01T00:00:00Z", false), true);
  assert.equal(canApply("open", "2099-01-01T00:00:00Z", true), false);
  assert.equal(canApply("open", "2000-01-01T00:00:00Z", false), false);
  assert.equal(
    canApply("applications_closed", "2099-01-01T00:00:00Z", false),
    false,
  );
});
