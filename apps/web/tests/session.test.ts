import assert from "node:assert/strict";
import test from "node:test";
import { loginDestination, tokenExpiry } from "../src/lib/session";
test("login destination preserves only the authenticated role’s requested path", () => {
  assert.equal(
    loginDestination("candidate", "/candidate/jobs?search=engineer"),
    "/candidate/jobs?search=engineer",
  );
  assert.equal(
    loginDestination("employer", "/employer/jobs/new"),
    "/employer/jobs/new",
  );
  assert.equal(loginDestination("candidate", "/employer/jobs"), "/candidate");
  assert.equal(loginDestination("employer", "/candidate/profile"), "/employer");
  assert.equal(
    loginDestination("candidate", "https://evil.example"),
    "/candidate",
  );
  assert.equal(loginDestination("candidate", "//evil.example"), "/candidate");
  assert.equal(loginDestination("candidate", "/candidate-other"), "/candidate");
});
test("token expiry parsing handles malformed cache entries without granting auth", () => {
  assert.equal(tokenExpiry("bad token"), null);
  const token = `header.${Buffer.from(JSON.stringify({ exp: 2000000000, role: "employer" })).toString("base64url")}.signature`;
  assert.equal(tokenExpiry(token), 2000000000000);
  assert.equal(
    tokenExpiry(`header.${Buffer.from("{}").toString("base64url")}.signature`),
    null,
  );
});
