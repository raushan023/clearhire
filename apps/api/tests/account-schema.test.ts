import assert from "node:assert/strict";
import test from "node:test";
import { updateCurrentUserSchema } from "../src/modules/auth/auth.schema.js";

test("account PATCH trims names and normalizes email consistently with registration", () => {
  assert.deepEqual(updateCurrentUserSchema.parse({ firstName: " Asha ", lastName: " Shah ", email: " ASHA@Example.Test " }),
    { firstName: "Asha", lastName: "Shah", email: "asha@example.test" });
});
test("account PATCH rejects empty requests, unknown fields, and protected auth fields", () => {
  for (const value of [{}, { id: "other" }, { userId: "other", firstName: "Changed" }, { role: "employer" }, { password: "password123" }, { firstName: " " }, { lastName: "x".repeat(101) }, { email: "bad" }]) {
    assert.equal(updateCurrentUserSchema.safeParse(value).success, false, JSON.stringify(value));
  }
});
test("account PATCH preserves omitted fields and supports international phone add/update/clear", () => {
  assert.deepEqual(updateCurrentUserSchema.parse({ firstName: "Changed" }), { firstName: "Changed" });
  for (const phone of ["+44 20 7946 0958", "(415) 555-0123", "+91-98765-43210", "+49 (30) 1234/5678"]) {
    assert.equal(updateCurrentUserSchema.parse({ phone: ` ${phone} ` }).phone, phone);
  }
  assert.equal(updateCurrentUserSchema.parse({ phone: null }).phone, null);
  assert.equal(updateCurrentUserSchema.parse({ phone: " " }).phone, null);
  for (const phone of ["not a phone", "+", "++123456", "12", "1".repeat(21), "1 ".repeat(33)])
    assert.equal(updateCurrentUserSchema.safeParse({ phone }).success, false);
});
