import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingState, PendingButton } from "../src/components/ui";
import { contactSchema } from "../src/components/ContactDetails";
import { previousListData } from "../src/lib/query";

test("shared initial loading UI announces progress without showing an empty state", () => {
  const html = renderToStaticMarkup(<LoadingState />);
  assert.match(html, /role="status"/);
  assert.match(html, /Loading your workspace/);
  assert.match(html, /skeleton-lines/);
  assert.doesNotMatch(html, /No results|No matching/);
});
test("pending button disables submission, announces busy state, and renders its spinner", () => {
  const html = renderToStaticMarkup(
    <PendingButton pending pendingText="Saving contact details…">
      Save contact details
    </PendingButton>,
  );
  assert.match(html, /disabled/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /loading-spinner/);
  assert.match(html, /Saving contact details/);
});
test("contact validation normalizes account values and accepts optional international phones", () => {
  const values = {
    firstName: " Asha ",
    lastName: " Shah ",
    email: " ASHA@Example.Test ",
    phone: "+44 (20) 7946-0958",
  };
  assert.deepEqual(contactSchema.parse(values), {
    ...values,
    firstName: "Asha",
    lastName: "Shah",
    email: "asha@example.test",
  });
  assert.equal(contactSchema.safeParse({ ...values, phone: "" }).success, true);
  assert.equal(
    contactSchema.safeParse({ ...values, phone: "call me" }).success,
    false,
  );
});
test("list placeholders stay within the same account, resource, and applicant job", () => {
  const data = { jobs: ["previous"] };
  assert.equal(
    previousListData(data, { queryKey: ["account", "one", "jobs", "page=1"] }, [
      "account",
      "one",
      "jobs",
      "page=2",
    ]),
    data,
  );
  for (const key of [
    ["account", "two", "jobs", "page=2"],
    ["account", "one", "profile"],
    ["account", "one", "job", "id"],
  ])
    assert.equal(
      previousListData(
        data,
        { queryKey: ["account", "one", "jobs", "page=1"] },
        key,
      ),
      undefined,
    );
  assert.equal(
    previousListData(
      data,
      { queryKey: ["account", "one", "applicants", "job1", "page=1"] },
      ["account", "one", "applicants", "job2", "page=2"],
    ),
    undefined,
  );
});
