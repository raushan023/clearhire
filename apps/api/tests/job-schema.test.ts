import assert from "node:assert/strict";
import test from "node:test";
import { updateJobSchema } from "../src/modules/job/job.schema.js";

test("title-only PATCH preserves all omitted relationships", () => {
    assert.deepEqual(updateJobSchema.parse({ title: "New title" }), { title: "New title" });
});
test("empty and unknown-only PATCH bodies are rejected", () => {
    assert.equal(updateJobSchema.safeParse({}).success, false);
    assert.equal(updateJobSchema.safeParse({ unexpected: true }).success, false);
});
test("explicit empty preferred skills and benefits are preserved as replacements", () => {
    assert.deepEqual(updateJobSchema.parse({ preferredSkillIds: [], benefitIds: [] }),
        { preferredSkillIds: [], benefitIds: [] });
    assert.equal(updateJobSchema.safeParse({ requiredSkillIds: [] }).success, false);
});
