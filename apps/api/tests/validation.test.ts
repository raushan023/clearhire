import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema } from "../src/modules/auth/auth.schema.js";
import { employerApplicationSearchSchema, updateApplicationStatusSchema } from "../src/modules/application/application.schema.js";
import { candidateProfileSchema } from "../src/modules/candidate/candidate.schema.js";
import { resumeFilenameSchema, validateResume, MAX_RESUME_BYTES } from "../src/modules/resume/resume.schema.js";
import { hashJobContent } from "../src/modules/job/job-duplicate.service.js";

const registration = { firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@example.test', role: 'candidate' };
test('password validation uses UTF-8 bytes', () => {
    assert.equal(registerSchema.safeParse({ ...registration, password: 'é'.repeat(36) }).success, true);
    assert.equal(registerSchema.safeParse({ ...registration, password: 'é'.repeat(37) }).success, false);
    assert.equal(registerSchema.parse({ ...registration, password: 'a'.repeat(72) }).email, 'ada@example.test');
});
test('employer filters accept every outcome but mutation cannot impersonate candidate/cancellation', () => {
    for (const status of ['applied', 'under_review', 'shortlisted', 'interview', 'final_review', 'offer',
        'offer_accepted', 'offer_declined', 'rejected', 'withdrawn', 'job_cancelled']) {
        assert.equal(employerApplicationSearchSchema.safeParse({ status }).success, true);
    }
    for (const status of ['offer_accepted', 'offer_declined', 'job_cancelled', 'withdrawn'])
        assert.equal(updateApplicationStatusSchema.safeParse({ status }).success, false);
});
test('profiles preserve omitted skills and reject duplicates', () => {
    assert.deepEqual(candidateProfileSchema.parse({ headline: 'Engineer' }), { headline: 'Engineer' });
    const id = '550e8400-e29b-41d4-a716-446655440000';
    assert.equal(candidateProfileSchema.safeParse({ skillIds: [id, id] }).success, false);
    assert.equal(candidateProfileSchema.safeParse({}).success, false);
});
test('resume validation rejects paths, spoofed types, empty and oversized uploads', () => {
    const pdf = Buffer.from('%PDF-1.7\nexample\n%%EOF');
    assert.doesNotThrow(() => validateResume(pdf, 'application/pdf'));
    assert.throws(() => validateResume(Buffer.from('not pdf'), 'application/pdf'));
    assert.throws(() => validateResume(pdf, 'image/png'));
    assert.throws(() => validateResume(Buffer.alloc(MAX_RESUME_BYTES + 1), 'application/pdf'));
    assert.throws(() => validateResume(Buffer.alloc(0), 'application/pdf'));
    assert.equal(resumeFilenameSchema.safeParse('../../secret.pdf').success, false);
});
test('duplicate hashing normalizes text, sorts canonical IDs and ignores hiring-cycle dates', () => {
    const job = { title: 'Engineer', description: 'Build reliable systems', salary_min: '1000', salary_max: '2000',
        experience_min: '1.0', experience_max: '3.0', required_ids: ['b', 'a'], company_id: 'one' };
    assert.equal(hashJobContent(job), hashJobContent({ ...job, title: ' ENGINEER ', description: 'Build  reliable systems',
        required_ids: ['a', 'b'], application_deadline: new Date(), openings: 99 }));
    assert.notEqual(hashJobContent(job), hashJobContent({ ...job, title: 'Different role' }));
});
