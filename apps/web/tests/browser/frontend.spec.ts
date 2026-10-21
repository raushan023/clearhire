import { test, expect, type Page } from "@playwright/test";
const jobId = "11111111-1111-4111-8111-111111111111",
  companyId = "22222222-2222-4222-8222-222222222222",
  applicationId = "33333333-3333-4333-8333-333333333333",
  skillId = "44444444-4444-4444-8444-444444444444";
const dates = {
  applicationDeadline: "2099-12-01T12:00:00Z",
  decisionDeadline: "2099-12-03T12:00:00Z",
};
async function fixture(
  page: Page,
  options: {
    role?: "candidate" | "employer";
    jobStatus?: string;
    applicationStatus?: string;
    guest?: boolean;
    publishConflict?: boolean;
    accountGate?: Promise<void>;
    contactConflict?: boolean;
  } = {},
) {
  const role = options.role ?? "candidate";
  let user = {
    id: "55555555-5555-4555-8555-555555555555",
    firstName: "Asha",
    lastName: "Shah",
    email: "asha@example.test",
    phone: "+44 20 7946 0958" as string | null,
    createdAt: "2026-10-01T12:00:00Z",
    role,
  };
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url")}.signature`;
  if (!options.guest)
    await page.addInitScript((token) => {
      sessionStorage.setItem("clearhire.accessToken", token);
    }, token);
  let jobStatus = options.jobStatus ?? "open",
    applicationStatus = options.applicationStatus ?? "applied";
  const company = {
    id: companyId,
    name: "Northstar Labs",
    website: "https://example.test",
    description: "A team building reliable software.",
    membershipRole: "owner",
  };
  const skill = { id: skillId, name: "TypeScript" };
  const profile = {
    headline: "Backend engineer",
    summary: "Reliable systems",
    totalExperience: 4,
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    currentCompany: "",
    currentTitle: "",
    skills: [skill],
  };
  const calls: { path: string; method: string; body: unknown }[] = [];
  function job() {
    return {
      id: jobId,
      title: "Senior backend engineer",
      company,
      status: jobStatus,
      description:
        "Build clear and reliable recruitment systems with our team.",
      workMode: "remote",
      employmentType: "full_time",
      location: { city: "Pune", state: "Maharashtra", country: "India" },
      experience: { min: 2, max: 5 },
      salary: { min: 1200000, max: 1800000, currency: "INR", period: "yearly" },
      openings: 2,
      ...dates,
      requiredSkills: [skill],
      preferredSkills: [],
      benefits: [{ id: skillId, name: "Health insurance" }],
      accountability: {
        decisionDeadlineMissed: false,
        decisionDeadlineMissedAt: null,
        candidatesAwaitingOutcome: 1,
      },
      changeHistory: [],
      statusHistory: [],
      applicationsClosedAt: null,
      cancelledAt: null,
      parentJobId: null,
    };
  }
  function application() {
    return {
      id: applicationId,
      status: applicationStatus,
      appliedAt: "2026-10-01T12:00:00Z",
      updatedAt: "2026-10-02T12:00:00Z",
      job: {
        id: jobId,
        title: job().title,
        company,
        status: jobStatus,
        ...dates,
      },
      timeline: [
        {
          fromStatus: null,
          toStatus: "applied",
          note: null,
          createdAt: "2026-10-01T12:00:00Z",
        },
      ],
      interviews: [],
      candidate: {
        ...user,
        profile: [
          "offer_accepted",
          "offer_declined",
          "rejected",
          "withdrawn",
          "job_cancelled",
        ].includes(applicationStatus)
          ? null
          : profile,
      },
      resume: null,
    };
  }
  function paged(key: string, values: unknown[]) {
    return {
      [key]: values,
      pagination: {
        page: 1,
        limit: 20,
        total: values.length,
        totalPages: values.length ? 1 : 0,
      },
    };
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace(/^\/api/, ""),
      method = request.method();
    const body =
      request.headers()["content-type"]?.includes("json") && request.postData()
        ? request.postDataJSON()
        : null;
    calls.push({ path, method, body });
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ status, json });
    if (path === "/auth/login") return reply({ accessToken: token, user });
    if (path === "/auth/register") return reply({ user }, 201);
    if (path === "/auth/current-user") {
      if (method === "PATCH") {
        await options.accountGate;
        if (options.contactConflict)
          return reply(
            {
              message: "An account with this email already exists",
              errors: { email: ["An account with this email already exists"] },
            },
            409,
          );
        user = {
          ...user,
          ...body,
          ...(body.email ? { email: body.email.trim().toLowerCase() } : {}),
        };
      }
      return reply({ user });
    }
    if (path === "/notifications/unread-count") return reply({ count: 2 });
    if (path === "/notifications")
      return reply(
        paged("notifications", [
          {
            id: skillId,
            title: "Application received",
            message: "Your application is in review.",
            applicationId,
            jobId,
            readAt: null,
            createdAt: "2026-10-01T12:00:00Z",
          },
        ]),
      );
    if (path.endsWith("/read")) return reply({ notification: {} });
    if (path === "/skills") return reply({ skills: [skill] });
    if (path === "/benefits")
      return reply({ benefits: [{ id: skillId, name: "Health insurance" }] });
    if (path === "/candidate/profile") return reply({ profile });
    if (path === "/candidate/resume")
      return method === "GET"
        ? reply({ resume: null })
        : reply({ message: "Resume storage is not configured" }, 503);
    if (path === "/candidate/saved-jobs") return reply(paged("jobs", []));
    if (path.startsWith("/candidate/saved-jobs/"))
      return route.fulfill({ status: 204 });
    if (path === "/applications/me")
      return reply({ applications: [application()] });
    if (path === `/applications/${applicationId}/offer-response`) {
      applicationStatus = body.response;
      return reply({ application: application() });
    }
    if (path === `/applications/${applicationId}/withdraw`) {
      applicationStatus = "withdrawn";
      return reply({ application: application() });
    }
    if (path === `/applications/${applicationId}`)
      return reply({ application: application() });
    if (path === `/jobs/${jobId}/publish`) {
      if (options.publishConflict)
        return reply(
          {
            message:
              "This company already has an active posting with the same content",
          },
          409,
        );
      jobStatus = "open";
      return reply({ job: job() });
    }
    if (path === `/employer/jobs/${jobId}/cancel`) {
      jobStatus = "cancelled";
      applicationStatus = "job_cancelled";
      return reply({ job: job() });
    }
    if (path === `/employer/jobs/${jobId}/status`) {
      jobStatus = body.status;
      return reply({ job: job() });
    }
    if (path === `/employer/jobs/${jobId}/repost`)
      return reply({ job: { id: jobId } }, 201);
    if (path === `/jobs/${jobId}`) return reply({ job: job() });
    if (path === "/jobs") return reply(paged("jobs", [job()]));
    if (path === "/companies") return reply({ companies: [company] });
    if (path === `/companies/${companyId}`) return reply({ company });
    if (path === `/companies/${companyId}/members`)
      return reply({ members: [{ ...user, userId: user.id, role: "owner" }] });
    if (path === "/employer/jobs")
      return reply(paged("jobs", [{ ...job(), applicationCount: 1 }]));
    if (path === `/employer/jobs/${jobId}/applications`)
      return reply(
        paged("applications", [{ ...application(), candidate: user }]),
      );
    if (path === `/employer/applications/${applicationId}`)
      return reply({ application: application() });
    if (path === `/employer/applications/${applicationId}/status`)
      return reply(
        { message: "All openings already have pending or accepted offers" },
        409,
      );
    if (path === "/employer/feedback-obligations")
      return reply({ overdueCount: 0, obligations: [] });
    return reply({ message: `Missing test fixture: ${method} ${path}` }, 404);
  });
  return calls;
}
test("protected routes redirect guests, login bootstraps the role, and logout clears session", async ({
  page,
}) => {
  await fixture(page, { guest: true });
  await page.goto("/candidate/jobs");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("asha@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log in →" }).click();
  await expect(page).toHaveURL(/\/candidate\/jobs$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("clearhire.accessToken")),
  ).toBeNull();
});
test("candidate and employer deep links enforce both role guards", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/employer/jobs/new");
  await expect(page).toHaveURL(/\/candidate$/);
  await expect(
    page.getByRole("link", { name: "Companies", exact: true }),
  ).toHaveCount(0);
  await fixture(page, { role: "employer" });
  await page.goto("/candidate/profile");
  await expect(page).toHaveURL(/\/employer$/);
  await expect(
    page.getByRole("link", { name: "Find jobs", exact: true }),
  ).toHaveCount(0);
});
test("401 clears stale authentication and preserves an expiry message", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/jobs?**", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Invalid or expired token" },
    }),
  );
  await page.goto("/candidate/jobs");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText("Your session has ended. Please log in again."),
  ).toBeVisible();
});
test("offer acceptance requires confirmation and hides response controls after final outcome", async ({
  page,
}) => {
  await fixture(page, { applicationStatus: "offer" });
  await page.goto(`/candidate/applications/${applicationId}`);
  await expect(
    page.getByRole("button", { name: "Withdraw application" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Accept offer", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accept offer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept offer", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Offer accepted", { exact: true })).toBeVisible();
});
test("publish conflicts display the backend business message and preserve draft actions", async ({
  page,
}) => {
  await fixture(page, {
    role: "employer",
    jobStatus: "draft",
    publishConflict: true,
  });
  await page.goto(`/employer/jobs/${jobId}`);
  await page.getByRole("button", { name: "Publish job", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publish job", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(
        "This company already has an active posting with the same content",
      ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(
    page.getByRole("button", { name: "Publish job", exact: true }),
  ).toBeVisible();
});
test("cancellation validates its reason and terminal jobs expose only repost management", async ({
  page,
}) => {
  const calls = await fixture(page, { role: "employer" });
  await page.goto(`/employer/jobs/${jobId}`);
  await page.getByRole("button", { name: "Cancel job", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel job", exact: true })
    .click();
  await expect(
    page.getByText("Provide a meaningful reason (at least 10 characters)."),
  ).toBeVisible();
  expect(calls.filter((c) => c.path.endsWith("/cancel"))).toHaveLength(0);
  await page
    .getByLabel("Cancellation reason")
    .fill("The requirement has been withdrawn for this cycle.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel job", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Repost as new draft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit job", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Publish job", exact: true }),
  ).toHaveCount(0);
});
test("job form blocks incomplete drafts and displays validation before sending", async ({
  page,
}) => {
  const calls = await fixture(page, { role: "employer" });
  await page.goto("/employer/jobs/new");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(
    page.getByText("Select at least one required skill."),
  ).toBeVisible();
  expect(
    calls.filter((c) => c.path === "/jobs" && c.method === "POST"),
  ).toHaveLength(0);
});
test("resume upload reports storage 503 explicitly and never claims success", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/candidate/resume");
  await page.getByLabel("PDF file (maximum 5 MiB)").setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nexample\n%%EOF"),
  });
  await page.getByRole("button", { name: "Review upload" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Upload PDF" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/Resume storage is not configured in this environment/),
  ).toBeVisible();
  await expect(page.getByText("Resume uploaded.", { exact: true })).toHaveCount(
    0,
  );
});
test("all candidate and employer routes render without uncaught errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page);
  await page.goto("/candidate");
  await expect(
    page.getByRole("heading", { name: "Recent applications" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/candidate-desktop.png",
    fullPage: true,
  });
  for (const path of [
    "/candidate",
    "/candidate/jobs",
    `/candidate/jobs/${jobId}`,
    "/candidate/saved-jobs",
    "/candidate/applications",
    `/candidate/applications/${applicationId}`,
    "/candidate/profile",
    "/candidate/resume",
    "/candidate/notifications",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Page not found", { exact: true })).toHaveCount(
      0,
    );
  }
  await fixture(page, { role: "employer" });
  await page.goto("/employer");
  await expect(
    page.getByRole("heading", { name: "Recent job activity" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/employer-desktop.png",
    fullPage: true,
  });
  for (const path of [
    "/employer",
    "/employer/profile",
    "/employer/companies",
    `/employer/companies/${companyId}`,
    "/employer/jobs",
    "/employer/jobs/new",
    `/employer/jobs/${jobId}`,
    `/employer/jobs/${jobId}/edit`,
    `/employer/jobs/${jobId}/applications`,
    `/employer/applications/${applicationId}`,
    "/employer/feedback-obligations",
    "/employer/notifications",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Page not found", { exact: true })).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
});
test("mobile browsing and applicant tables fit the viewport and dialogs support Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto("/candidate/jobs");
  await expect(
    page.getByRole("link", { name: "Senior backend engineer", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/candidate-mobile.png",
    fullPage: true,
  });
  await fixture(page, { role: "employer" });
  await page.goto(`/employer/jobs/${jobId}/applications`);
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/employer/jobs/${jobId}`);
  await page.getByRole("button", { name: "Cancel job", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/employer-mobile.png",
    fullPage: true,
  });
});

for (const role of ["candidate", "employer"] as const) {
  test(`${role} contact form populates, blocks duplicate saves, and refreshes the authenticated account`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = await fixture(page, { role, accountGate: gate });
    await page.goto(`/${role}/profile`);
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
      "Asha",
    );
    await expect(page.getByLabel("Last name", { exact: true })).toHaveValue(
      "Shah",
    );
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
      "asha@example.test",
    );
    await expect(page.getByLabel("Phone number (optional)")).toHaveValue(
      "+44 20 7946 0958",
    );
    if (role === "candidate")
      await expect(
        page.getByRole("heading", {
          name: "Professional profile",
          exact: true,
        }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", {
          name: "Professional profile",
          exact: true,
        }),
      ).toHaveCount(0);
    if (role === "employer") {
      // Warm the member cache before saving; self-account display must not go stale.
      await page.getByRole("link", { name: "Companies", exact: true }).click();
      await page.getByRole("link", { name: "Northstar Labs", exact: true }).click();
      await expect(page.locator(".member-list")).toContainText("Asha Shah");
      await page.getByRole("link", { name: "Account", exact: true }).click();
    }
    await page.getByLabel("First name", { exact: true }).fill("Mira");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("MIRA@Example.Test");
    await page.getByLabel("Phone number (optional)").fill("+49 (30) 1234-5678");
    const form = page.locator(".contact-panel form");
    await page
      .getByRole("button", { name: "Save contact details", exact: true })
      .click();
    const pending = page.getByRole("button", {
      name: "Saving contact details…",
      exact: true,
    });
    await expect(pending).toBeDisabled();
    await expect(pending.locator(".loading-spinner")).toBeVisible();
    await form.evaluate((element: HTMLFormElement) => {
      element.requestSubmit();
      element.requestSubmit();
    });
    await expect
      .poll(
        () =>
          calls.filter(
            (call) =>
              call.path === "/auth/current-user" && call.method === "PATCH",
          ).length,
      )
      .toBe(1);
    release();
    await expect(
      page.getByText("Contact details saved.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".user-name")).toHaveText("Mira");
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
      "mira@example.test",
    );
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page.locator("main h1")).toContainText("Mira");
    expect(
      calls.filter(
        (call) => call.path === "/auth/current-user" && call.method === "PATCH",
      ),
    ).toHaveLength(1);
    if (role === "employer") {
      await page.getByRole("link", { name: "Companies", exact: true }).click();
      await page.getByRole("link", { name: "Northstar Labs", exact: true }).click();
      await expect(page.locator(".member-list")).toContainText("Mira Shah");
      await expect(page.locator(".member-list")).toContainText("mira@example.test");
    }
    // Persisted account data is also returned on a fresh session bootstrap.
    await page.goto(`/${role}/profile`);
    await expect(page.getByLabel("Phone number (optional)")).toHaveValue(
      "+49 (30) 1234-5678",
    );
    await page.getByLabel("Phone number (optional)").fill("");
    await page
      .getByRole("button", { name: "Save contact details", exact: true })
      .click();
    await expect(
      page.getByText("Contact details saved.", { exact: true }),
    ).toBeVisible();
    expect(
      calls
        .filter(
          (call) =>
            call.path === "/auth/current-user" && call.method === "PATCH",
        )
        .at(-1)?.body,
    ).toEqual({ phone: null });
  });
}
test("duplicate email displays the field conflict without changing the authenticated account", async ({
  page,
}) => {
  await fixture(page, { contactConflict: true });
  await page.goto("/candidate/profile");
  await page.getByLabel("First name", { exact: true }).fill("Rejected name");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("taken@example.test");
  await page
    .getByRole("button", { name: "Save contact details", exact: true })
    .click();
  await expect(
    page.getByLabel("Email address", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page
      .locator(".field-error")
      .filter({ hasText: "An account with this email already exists" }),
  ).toBeVisible();
  await expect(page.locator(".user-name")).toHaveText("Asha");
  await expect(
    page.getByText("Contact details saved.", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
    "Asha",
  );
});
test("initial list fetch shows a loader before the genuine empty state", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/candidate/saved-jobs?**", async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto("/candidate/saved-jobs");
  await expect(page.locator("main .loading-state")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /No saved|Nothing saved|Save your/ }),
  ).toHaveCount(0);
  release();
  await expect(page.locator("main .loading-state")).toHaveCount(0);
  await expect(page.locator("main .state h2")).toBeVisible();
});
test("lazy employer account route shows the shared Suspense fallback inside the protected workspace", async ({
  page,
}) => {
  await fixture(page, { role: "employer" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/src/pages/EmployerProfile.tsx*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/employer");
  await expect(page.locator("main h1")).toBeVisible();
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.locator("main .loading-state")).toBeVisible();
  await expect(page.locator(".user-name")).toHaveText("Asha");
  release();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main .loading-state")).toHaveCount(0);
});
test("background refetch keeps loaded jobs visible and reports a transient refresh failure", async ({
  page,
}) => {
  await page.clock.install();
  await fixture(page);
  await page.goto("/candidate/jobs");
  const jobLink = page.getByRole("link", {
    name: "Senior backend engineer",
    exact: true,
  });
  await expect(jobLink).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/jobs?**", async (route) => {
    await gate;
    await route.fulfill({
      status: 500,
      json: { message: "Temporary failure" },
    });
  });
  await page.clock.fastForward(31_000);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByText("Refreshing…", { exact: true })).toBeVisible();
  await expect(jobLink).toBeVisible();
  await expect(page.locator("main .loading-state")).toHaveCount(0);
  release();
  await expect(
    page.getByText(
      "Some data could not refresh. Showing the last available information.",
    ),
  ).toBeVisible();
  await expect(jobLink).toBeVisible();
});

test("a late contact-save response after logout cannot restore the previous account", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls = await fixture(page, { accountGate: gate });
  await page.goto("/candidate/profile");
  await page.getByLabel("First name", { exact: true }).fill("Late account");
  await page
    .getByRole("button", { name: "Save contact details", exact: true })
    .click();
  await expect
    .poll(
      () =>
        calls.filter(
          (call) =>
            call.path === "/auth/current-user" && call.method === "PATCH",
        ).length,
    )
    .toBe(1);
  const response = page.waitForResponse(
    (result) =>
      result.url().endsWith("/api/auth/current-user") &&
      result.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  release();
  await response;
  await expect(
    page.getByRole("button", { name: "Log in →", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".user-name")).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("clearhire.accessToken")),
  ).toBeNull();
});
test("candidate and employer contact forms fit mobile and tablet viewports", async ({
  page,
}) => {
  for (const role of ["candidate", "employer"] as const) {
    await fixture(page, { role });
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${role}/profile`);
      await expect(
        page.getByLabel("Email address", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.getByLabel("First name", { exact: true }).focus();
      await expect(
        page.getByLabel("First name", { exact: true }),
      ).toBeFocused();
      if (width === 390)
        await page.screenshot({
          path: `test-results/${role}-contact-mobile.png`,
          fullPage: true,
        });
    }
  }
});
