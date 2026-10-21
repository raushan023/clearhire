import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { applyMigrations } from "../../src/db/migration-runner.js";
import { createJobSchema, updateJobSchema } from "../../src/modules/job/job.schema.js";
import type { ResumeStorage } from "../../src/modules/resume/resume.storage.js";
import { localTestDatabaseUrl } from '../helpers/local-test-database.js';

// Never fall back to DATABASE_URL, DATABASE_URL_POOLED, or dotenv. These tests
// create a new isolated schema in an explicitly selected LOCAL *_test database.
const testUrl = process.env.TEST_DATABASE_URL;
test('PostgreSQL backend regression suite', { skip: !testUrl }, async t => {
    const url = localTestDatabaseUrl(testUrl!);
    const schema = `clearhire_test_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: url.toString() });
    url.searchParams.set('options', `-c search_path=${schema},public`);
    process.env.DATABASE_URL_POOLED = url.toString();
    process.env.JWT_ACCESS_SECRET = 'local-test-only-access-signing-secret';
    const db = new Pool({ connectionString: url.toString() });
    const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations');
    let apiPool: Pool | undefined;
    let workerPool: Pool | undefined;
    try {
        await admin.query('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public');
        await admin.query(`CREATE SCHEMA ${schema}`);
        let bootstrapVerified = false;
        await t.test('fresh bootstrap and repeated migration runs', async () => {
            await applyMigrations(db, migrations);
            const before = await db.query('SELECT filename FROM schema_migrations ORDER BY filename');
            assert.equal(before.rowCount, 25);
            await Promise.all([applyMigrations(db, migrations), applyMigrations(db, migrations)]);
            assert.deepEqual((await db.query('SELECT filename FROM schema_migrations ORDER BY filename')).rows, before.rows);
            assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname = $1 AND indexname LIKE 'idx_notifications_feedback%'", [schema])).rows[0].n, 1);
            bootstrapVerified = true;
        });
        // node:test reports a failed child without throwing from t.test().
        // Never let failed bootstrap fall through to public-schema tables.
        assert.ok(bootstrapVerified, 'Migration bootstrap must pass before service tests run');
        const auth = await import('../../src/modules/auth/auth.service.js');
        const jobs = await import('../../src/modules/job/job.service.js');
        const applications = await import('../../src/modules/application/application.service.js');
        const companies = await import('../../src/modules/company/company.service.js');
        const candidates = await import('../../src/modules/candidate/candidate.service.js');
        const resumes = await import('../../src/modules/resume/resume.service.js');
        const notifications = await import('../../src/modules/notification/notification.service.js');
        const close = await import('../../../worker/src/jobs/close-expired-applications.job.js');
        const missed = await import('../../../worker/src/jobs/mark-missed-decision-deadlines.job.js');
        const reminders = await import('../../../worker/src/jobs/create-feedback-reminders.job.js');
        const escalations = await import('../../../worker/src/jobs/create-feedback-escalations.job.js');
        apiPool = (await import('../../src/config/database.js')).pool;
        workerPool = (await import('../../../worker/src/config/database.js')).pool;
        const employer = await auth.registerUser({ firstName: 'Employer', lastName: 'One', email: 'employer@example.test', password: 'password123', role: 'employer' });
        const outsider = await auth.registerUser({ firstName: 'Employer', lastName: 'Two', email: 'outsider@example.test', password: 'password123', role: 'employer' });
        const candidate = await auth.registerUser({ firstName: 'Candidate', lastName: 'One', email: 'candidate@example.test', password: 'password123', role: 'candidate' });
        const second = await auth.registerUser({ firstName: 'Candidate', lastName: 'Two', email: 'candidate2@example.test', password: 'password123', role: 'candidate' });
        const company = await companies.createCompany(employer.id, { name: 'Test company' });
        const skillRows = await db.query('SELECT id FROM skills ORDER BY name LIMIT 2');
        const benefitRows = await db.query('SELECT id FROM benefits ORDER BY name LIMIT 1');
        let sequence = 0;
        async function draft(overrides: Record<string, unknown> = {}) {
            return jobs.createJob(employer.id, createJobSchema.parse({ companyId: company.id,
                title: `Role ${++sequence}`, description: 'A transparent engineering opportunity', employmentType: 'full_time', workMode: 'remote',
                country: 'India', experienceMin: 1, experienceMax: 3, salaryMin: 100, salaryMax: 200,
                salaryCurrency: 'INR', salaryPeriod: 'yearly', openings: 1,
                applicationDeadline: new Date(Date.now() + 86400000), decisionDeadline: new Date(Date.now() + 172800000),
                requiredSkillIds: [skillRows.rows[0].id], preferredSkillIds: [skillRows.rows[1].id], benefitIds: [benefitRows.rows[0].id], ...overrides }));
        }
        async function open(overrides: Record<string, unknown> = {}) {
            const job = await draft(overrides); await jobs.publishJob(employer.id, job.id); return job;
        }
        async function applicationAt(jobId: string, status: string, candidateId = candidate.id) {
            const a = await applications.applyToJob(candidateId, jobId);
            // Fixture setup only. Actual transition/history behavior is tested below.
            await db.query('UPDATE applications SET status = $2 WHERE id = $1', [a.id, status]);
            return a;
        }
        await t.test('shared current-user HTTP PATCH enforces ownership, validation, phone, and concurrent email conflicts', async () => {
            const app = (await import('../../src/app.js')).default;
            const jwt = (await import('jsonwebtoken')).default;
            const server = app.listen(0, '127.0.0.1');
            await new Promise<void>(resolve => server.once('listening', resolve));
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            const endpoint = `http://127.0.0.1:${address.port}/api/auth/current-user`;
            const accounts = await Promise.all((['candidate', 'employer'] as const).map(role => auth.registerUser({
                firstName: 'Contact', lastName: 'Original', email: `contact-${role}@example.test`, password: 'password123', role,
            })));
            const headers = (user: typeof accounts[number]) => ({ Authorization: `Bearer ${jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })}`, 'Content-Type': 'application/json' });
            const patch = (user: typeof accounts[number], body: unknown) => fetch(endpoint, { method: 'PATCH', headers: headers(user), body: JSON.stringify(body) });
            try {
                assert.equal((await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"firstName":"No"}' })).status, 401);
                for (const user of accounts) {
                    const changed = await patch(user, { firstName: ' Updated ', email: ` CONTACT-${user.role}@EXAMPLE.TEST `, phone: ' +44 (20) 7946-0958 ' });
                    assert.equal(changed.status, 200);
                    const body = await changed.json();
                    assert.equal(body.user.firstName, 'Updated');
                    assert.equal(body.user.lastName, 'Original');
                    assert.equal(body.user.email, `contact-${user.role}@example.test`);
                    assert.equal(body.user.phone, '+44 (20) 7946-0958');
                    assert.equal(body.user.id, user.id);
                    assert.equal(body.user.role, user.role);
                    assert.equal('password_hash' in body.user || 'passwordHash' in body.user, false);
                    assert.equal((await patch(user, { phone: '(415) 555-0123' })).status, 200);
                    assert.equal((await fetch(endpoint, { headers: headers(user) }).then(r => r.json())).user.phone, '(415) 555-0123');
                    assert.equal((await patch(user, { phone: null })).status, 200);
                    assert.equal((await fetch(endpoint, { headers: headers(user) }).then(r => r.json())).user.phone, null);
                    for (const forbidden of [{}, { id: accounts[1].id, firstName: 'Hijack' }, { userId: accounts[0].id }, { role: 'candidate' }, { password: 'new-password' }])
                        assert.equal((await patch(user, forbidden)).status, 400);
                    assert.equal((await fetch(`${endpoint}/${accounts[1].id}`, { method: 'PATCH', headers: headers(user), body: '{"firstName":"Hijack"}' })).status, 404);
                }
                const beforeOther = await auth.getCurrentUser(accounts[1].id);
                await patch(accounts[0], { lastName: 'Self only' });
                assert.deepEqual(await auth.getCurrentUser(accounts[1].id), beforeOther);
                const races = await Promise.all(accounts.map(user => patch(user, { email: ' SHARED-CONTACT@EXAMPLE.TEST ' })));
                assert.deepEqual(races.map(response => response.status).sort(), [200, 409]);
                const conflict = await races.find(response => response.status === 409)!.json();
                assert.equal(conflict.code, 'EMAIL_ALREADY_EXISTS');
                assert.ok(conflict.errors.email.length);
                assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM users WHERE LOWER(email) = 'shared-contact@example.test'")).rows[0].n, 1);
            } finally {
                await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            }
        });
        await t.test('duplicate registration is a business conflict even under concurrency', async () => {
            const input = { firstName: 'Race', lastName: 'Test', email: 'race@example.test', password: 'password123', role: 'candidate' as const };
            const results = await Promise.allSettled([auth.registerUser(input), auth.registerUser(input)]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
            const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
            assert.equal(rejected.reason.message, 'EMAIL_ALREADY_EXISTS');
        });
        await t.test('PATCH preserves omitted relationships and invalid references roll back', async () => {
            const j = await open();
            const skillsBefore = await db.query('SELECT skill_id, skill_type FROM job_skills WHERE job_id = $1 ORDER BY skill_id', [j.id]);
            await jobs.updateJob(employer.id, j.id, updateJobSchema.parse({ title: 'Changed title' }));
            assert.deepEqual((await db.query('SELECT skill_id, skill_type FROM job_skills WHERE job_id = $1 ORDER BY skill_id', [j.id])).rows, skillsBefore.rows);
            assert.equal((await db.query('SELECT 1 FROM job_benefits WHERE job_id = $1', [j.id])).rowCount, 1);
            await assert.rejects(() => jobs.updateJob(employer.id, j.id, updateJobSchema.parse({ title: 'Must roll back', requiredSkillIds: [randomUUID()] })));
            assert.equal((await jobs.getJobById(employer.id, 'employer', j.id)).title, 'Changed title');
        });
        await t.test('authorization and duplicate application guards', async () => {
            const j = await open();
            const a = await applications.applyToJob(candidate.id, j.id);
            await assert.rejects(() => applications.applyToJob(candidate.id, j.id), /ALREADY_APPLIED/);
            await assert.rejects(() => applications.getCandidateApplicationById(second.id, a.id), /APPLICATION_NOT_FOUND/);
            await assert.rejects(() => applications.getEmployerApplicationById(outsider.id, a.id), /APPLICATION_ACCESS_DENIED/);
            await assert.rejects(() => applications.updateApplicationStatus(outsider.id, a.id, { status: 'under_review' }), /APPLICATION_ACCESS_DENIED/);
            await assert.rejects(() => jobs.updateJob(outsider.id, j.id, { title: 'Hijack' }), /JOB_ACCESS_DENIED/);
            await assert.rejects(() => companies.updateCompany(outsider.id, company.id, { name: 'Hijack' }), /COMPANY_OWNER_REQUIRED/);
            await assert.rejects(() => applications.updateApplicationStatus(employer.id, a.id, { status: 'offer' }), /INVALID_STATUS_TRANSITION/);
            for (const status of ['under_review', 'shortlisted', 'interview', 'final_review', 'offer'] as const)
                await applications.updateApplicationStatus(employer.id, a.id, { status });
            const detail = await applications.getEmployerApplicationById(employer.id, a.id);
            assert.equal(detail.timeline.length, 6);
            assert.equal(detail.candidate.email, candidate.email);
        });
        await t.test('HTTP authorization, validation, and pagination contracts', async () => {
            const app = (await import('../../src/app.js')).default;
            const jwt = (await import('jsonwebtoken')).default;
            const server = app.listen(0, '127.0.0.1');
            await new Promise<void>(resolve => server.once('listening', resolve));
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            const base = `http://127.0.0.1:${address.port}`;
            const token = (id: string, role: string) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
            const candidateHeaders = { Authorization: `Bearer ${token(candidate.id, 'candidate')}` };
            const employerHeaders = { Authorization: `Bearer ${token(employer.id, 'employer')}` };
            try {
                assert.equal((await fetch(`${base}/api/candidate/profile`)).status, 401);
                assert.equal((await fetch(`${base}/api/candidate/profile`, { headers: { Authorization: `Bearer ${token(employer.id, 'employer')}` } })).status, 403);
                const j = await open(); const a = await applications.applyToJob(candidate.id, j.id);
                const unauthorized = await fetch(`${base}/api/applications/${a.id}`, { headers: { Authorization: `Bearer ${token(second.id, 'candidate')}` } });
                assert.equal(unauthorized.status, 404);
                assert.equal((await fetch(`${base}/api/jobs/${j.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token(employer.id, 'employer')}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
                assert.equal((await fetch(`${base}/api/jobs/${j.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token(employer.id, 'employer')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requiredSkillIds: [randomUUID()] }) })).status, 400);
                const page = await fetch(`${base}/api/notifications?page=1&limit=1`, { headers: candidateHeaders });
                assert.equal(page.status, 200); const body = await page.json() as { pagination: { limit: number } };
                assert.equal(body.pagination.limit, 1);
                assert.equal((await fetch(`${base}/api/candidate/resume`, { method: 'PUT', headers: { ...candidateHeaders, 'Content-Type': 'application/pdf' }, body: '%PDF-1.7\nexample\n%%EOF' })).status, 503);
                for (const suffix of ['', '/']) {
                    for (const resource of ['profile', 'saved-jobs', 'resume']) {
                        const path = `${base}/api/candidate/${resource}${suffix}`;
                        assert.equal((await fetch(path, { headers: candidateHeaders })).status, 200);
                        const head = await fetch(path, { method: 'HEAD', headers: candidateHeaders });
                        assert.equal(head.status, 200); assert.equal(await head.text(), '');
                    }
                    const members = await fetch(`${base}/api/companies/${company.id}/members${suffix}`, { headers: employerHeaders });
                    assert.equal(members.status, 200);
                    const memberBody = await members.json() as { members: { userId: string }[]; company?: unknown };
                    assert.equal(memberBody.members[0].userId, employer.id); assert.equal(memberBody.company, undefined);
                    assert.equal((await fetch(`${base}/api/companies/${company.id}/members${suffix}`, { method: 'HEAD', headers: employerHeaders })).status, 200);
                    // Storage is unavailable; a metadata dispatch bug would incorrectly return 200.
                    for (const method of ['GET', 'HEAD']) assert.equal((await fetch(`${base}/api/candidate/resume/download${suffix}`, { method, headers: candidateHeaders })).status, 503);
                }
                const jsonHeaders = { 'Content-Type': 'application/json' };
                assert.equal((await fetch(`${base}/api/auth/register`, { method: 'POST', headers: jsonHeaders, body: '{broken' })).status, 400);
                assert.equal((await fetch(`${base}/api/auth/register`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text: 'x'.repeat(110000) }) })).status, 413);
                assert.equal((await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=unsupported-test' }, body: '{}' })).status, 415);
                assert.equal((await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { ...jsonHeaders, 'Content-Encoding': 'unsupported-test' }, body: '{}' })).status, 415);
                const closed = await open(); await jobs.updateJobStatus(employer.id, closed.id, { status: 'applications_closed' });
                assert.equal((await fetch(`${base}/api/candidate/saved-jobs/${closed.id}`, { method: 'PUT', headers: candidateHeaders })).status, 409);
                assert.equal((await fetch(`${base}/api/jobs/${closed.id}/apply`, { method: 'POST', headers: candidateHeaders })).status, 409);
                const hidden = await draft();
                assert.equal((await fetch(`${base}/api/candidate/saved-jobs/${hidden.id}`, { method: 'PUT', headers: candidateHeaders })).status, 404);
                assert.equal((await fetch(`${base}/api/candidate/saved-jobs/${randomUUID()}`, { method: 'PUT', headers: candidateHeaders })).status, 404);
                // Public response shapes remain curated camelCase, including nested fields.
                function assertCamelCase(value: unknown): void {
                    if (Array.isArray(value)) { value.forEach(assertCamelCase); return; }
                    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
                        assert.ok(!key.includes('_'), `Unexpected snake_case field: ${key}`); assertCamelCase(child);
                    }
                }
                for (const path of [`/api/companies/${company.id}`, `/api/companies/${company.id}/members/`, '/api/candidate/profile', '/api/candidate/saved-jobs', '/api/candidate/resume', `/api/employer/applications/${a.id}`, `/api/jobs/${j.id}`]) {
                    const response = await fetch(`${base}${path}`, { headers: path.startsWith('/api/candidate') ? candidateHeaders : employerHeaders });
                    assert.equal(response.status, 200); assertCamelCase(await response.json());
                }

            } finally {
                server.closeAllConnections();
                await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            }
        });
        await t.test('terminal outcomes cannot be withdrawn or offer responses rewritten', async () => {
            for (const status of ['offer_accepted', 'offer_declined', 'rejected', 'withdrawn', 'job_cancelled', 'offer']) {
                const j = await open(); const a = await applicationAt(j.id, status);
                await assert.rejects(() => applications.withdrawApplication(candidate.id, a.id), /APPLICATION_NOT_WITHDRAWABLE/);
            }
            const j = await open(); const a = await applicationAt(j.id, 'offer');
            await applications.respondToOffer(candidate.id, a.id, { response: 'offer_accepted' });
            await assert.rejects(() => applications.respondToOffer(candidate.id, a.id, { response: 'offer_accepted' }), /APPLICATION_NOT_IN_OFFER_STAGE/);
            await assert.rejects(() => applications.respondToOffer(candidate.id, a.id, { response: 'offer_declined' }), /APPLICATION_NOT_IN_OFFER_STAGE/);
        });
        await t.test('concurrent offers obey capacity and opening edits respect occupied slots', async () => {
            const j = await open();
            const a = await applicationAt(j.id, 'final_review'); const b = await applicationAt(j.id, 'final_review', second.id);
            const results = await Promise.allSettled([applications.updateApplicationStatus(employer.id, a.id, { status: 'offer' }), applications.updateApplicationStatus(employer.id, b.id, { status: 'offer' })]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
            assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, 'NO_OPENINGS_AVAILABLE');
            const multi = await open({ openings: 3 });
            await applicationAt(multi.id, 'offer_accepted'); await applicationAt(multi.id, 'offer', second.id);
            await assert.rejects(() => jobs.updateJob(employer.id, multi.id, { openings: 1 }), /OPENINGS_BELOW_OCCUPIED_CAPACITY/);
        });
        await t.test('manual closure metadata, fill requirements, and historical access', async () => {
            const j = await open({ openings: 2 }); const a = await applicationAt(j.id, 'offer');
            await jobs.updateJobStatus(employer.id, j.id, { status: 'applications_closed' });
            const closed = await jobs.getJobById(candidate.id, 'candidate', j.id);
            assert.equal(closed.applicationsClosedBy, 'employer'); assert.ok(closed.applicationsClosedAt);
            await assert.rejects(() => jobs.getJobById(second.id, 'candidate', j.id), /JOB_NOT_ACCESSIBLE/);
            await jobs.updateJobStatus(employer.id, j.id, { status: 'hiring_in_progress' });
            await assert.rejects(() => jobs.updateJobStatus(employer.id, j.id, { status: 'filled' }), /UNRESOLVED_APPLICATIONS_EXIST/);
            await applications.respondToOffer(candidate.id, a.id, { response: 'offer_accepted' });
            await assert.rejects(() => jobs.updateJobStatus(employer.id, j.id, { status: 'filled' }), /OPENINGS_NOT_FILLED/);
            await db.query("INSERT INTO applications(job_id, candidate_id, status) VALUES ($1, $2, 'offer_accepted')", [j.id, second.id]);
            await jobs.updateJobStatus(employer.id, j.id, { status: 'filled' });
            assert.equal((await jobs.getJobById(candidate.id, 'candidate', j.id)).status, 'filled');
            await assert.rejects(() => jobs.updateJobStatus(employer.id, j.id, { status: 'applications_closed' }), /INVALID_JOB_STATUS_TRANSITION/);
        });
        await t.test('cancellation preserves history, cancels interviews, and blocks accepted offers', async () => {
            const blocked = await open(); await applicationAt(blocked.id, 'offer_accepted');
            await assert.rejects(() => jobs.cancelJob(employer.id, blocked.id, { reason: 'Requirement withdrawn' }), /ACCEPTED_OFFER_EXISTS/);
            const j = await open(); const a = await applicationAt(j.id, 'interview');
            const resolved = await applicationAt(j.id, 'rejected', second.id);
            const interview = await applications.scheduleInterview(employer.id, a.id, { mode: 'phone', scheduledAt: new Date(Date.now() + 3600000) });
            await jobs.cancelJob(employer.id, j.id, { reason: 'Requirement has been withdrawn' });
            const detail = await applications.getCandidateApplicationById(candidate.id, a.id);
            assert.equal((await applications.getCandidateApplicationById(second.id, resolved.id)).status, 'rejected');
            assert.equal(detail.status, 'job_cancelled'); assert.equal(detail.interviews[0].status, 'cancelled');
            assert.equal(detail.timeline.at(-1)?.toStatus, 'job_cancelled');
            const historical = await jobs.getJobById(candidate.id, 'candidate', j.id);
            assert.equal(historical.cancellationReason, 'Requirement has been withdrawn');
            await assert.rejects(() => applications.rescheduleInterview(employer.id, interview.id, { mode: 'phone', scheduledAt: new Date(Date.now() + 7200000) }), /INTERVIEW_CANCELLED/);
            const repost = await jobs.repostJob(employer.id, j.id, { applicationDeadline: new Date(Date.now() + 86400000), decisionDeadline: new Date(Date.now() + 172800000) });
            assert.equal(repost.status, 'draft'); assert.equal(repost.parentJobId, j.id);
            for (const table of ['applications', 'job_change_events', 'job_status_events'])
                assert.equal((await db.query(`SELECT 1 FROM ${table} WHERE job_id = $1`, [repost.id])).rowCount, 0);
        });
        await t.test('interview cannot be rescheduled after leaving interview stage', async () => {
            const j = await open(); const a = await applicationAt(j.id, 'interview');
            const i = await applications.scheduleInterview(employer.id, a.id, { mode: 'phone', scheduledAt: new Date(Date.now() + 3600000) });
            await applications.updateApplicationStatus(employer.id, a.id, { status: 'final_review' });
            await assert.rejects(() => applications.rescheduleInterview(employer.id, i.id, { mode: 'phone', scheduledAt: new Date(Date.now() + 7200000) }), /APPLICATION_NOT_IN_INTERVIEW_STAGE/);
        });
        await t.test('worker jobs are idempotent and pending offers remain unresolved', async () => {
            const draftJob = await draft();
            await db.query("UPDATE jobs SET application_deadline = NOW() - INTERVAL '5 days', decision_deadline = NOW() - INTERVAL '4 days' WHERE id = $1", [draftJob.id]);
            const j = await open(); const a = await applicationAt(j.id, 'offer');
            await db.query("UPDATE jobs SET application_deadline = NOW() - INTERVAL '5 days', decision_deadline = NOW() - INTERVAL '4 days' WHERE id = $1", [j.id]);
            await close.closeExpiredApplications(); await close.closeExpiredApplications();
            assert.equal((await jobs.getJobById(candidate.id, 'candidate', j.id)).applicationsClosedBy, 'system');
            assert.equal((await db.query("SELECT 1 FROM job_status_events WHERE job_id = $1 AND to_status = 'applications_closed'", [j.id])).rowCount, 1);
            await missed.markMissedDecisionDeadlines();
            assert.equal((await db.query('SELECT decision_deadline_missed_at FROM jobs WHERE id = $1', [draftJob.id])).rows[0].decision_deadline_missed_at, null);
            const first = (await db.query('SELECT decision_deadline_missed_at FROM jobs WHERE id = $1', [j.id])).rows[0].decision_deadline_missed_at;
            await missed.markMissedDecisionDeadlines();
            assert.deepEqual((await db.query('SELECT decision_deadline_missed_at FROM jobs WHERE id = $1', [j.id])).rows[0].decision_deadline_missed_at, first);
            await reminders.createFeedbackReminders(); await reminders.createFeedbackReminders();
            assert.equal((await db.query("SELECT 1 FROM notifications WHERE job_id = $1 AND type = 'feedback_overdue'", [j.id])).rowCount, 1);
            assert.equal((await jobs.getJobById(candidate.id, 'candidate', j.id)).accountability.candidatesAwaitingOutcome, 1);
            assert.ok((await applications.getEmployerFeedbackObligations(employer.id)).some(o => o.applicationId === a.id));
            await db.query("UPDATE jobs SET decision_deadline_missed_at = NOW() - INTERVAL '4 days' WHERE id = $1", [j.id]);
            await escalations.createFeedbackEscalations(); await escalations.createFeedbackEscalations();
            assert.equal((await db.query("SELECT 1 FROM notifications WHERE job_id = $1 AND type IN ('feedback_overdue_24h', 'feedback_overdue_72h')", [j.id])).rowCount, 2);
            const resolved = await open(); const resolvedApp = await applicationAt(resolved.id, 'offer');
            await db.query("UPDATE jobs SET decision_deadline_missed_at = NOW() - INTERVAL '4 days' WHERE id = $1", [resolved.id]);
            await applications.respondToOffer(candidate.id, resolvedApp.id, { response: 'offer_declined' });
            await escalations.createFeedbackEscalations();
            assert.equal((await db.query("SELECT 1 FROM notifications WHERE job_id = $1 AND type LIKE 'feedback_overdue%'", [resolved.id])).rowCount, 0);
        });
        await t.test('overdue deadline extended before worker scan records the original deadline', async () => {
            const j = await open(); await applications.applyToJob(candidate.id, j.id);
            const oldDeadline = new Date(Date.now() - 3600000);
            await db.query("UPDATE jobs SET application_deadline = $2::timestamptz - INTERVAL '1 day', decision_deadline = $2 WHERE id = $1", [j.id, oldDeadline]);
            await jobs.updateJob(employer.id, j.id, { applicationDeadline: new Date(Date.now() + 86400000), decisionDeadline: new Date(Date.now() + 3 * 86400000) });
            assert.deepEqual((await jobs.getJobById(employer.id, 'employer', j.id)).accountability.decisionDeadlineMissedAt, oldDeadline);
        });
        await t.test('deadline edits preserve an existing marker and do not invent an unmissed deadline', async () => {
            const j = await open();
            const marker = new Date('2026-01-01T00:00:00Z');
            await db.query('UPDATE jobs SET decision_deadline_missed_at = $2 WHERE id = $1', [j.id, marker]);
            await jobs.updateJob(employer.id, j.id, { decisionDeadline: new Date(Date.now() + 3 * 86400000) });
            assert.deepEqual((await jobs.getJobById(employer.id, 'employer', j.id)).accountability.decisionDeadlineMissedAt, marker);
            const future = await open(); await applications.applyToJob(candidate.id, future.id);
            await jobs.updateJob(employer.id, future.id, { decisionDeadline: new Date(Date.now() + 3 * 86400000) });
            assert.equal((await jobs.getJobById(employer.id, 'employer', future.id)).accountability.decisionDeadlineMissedAt, null);
            const empty = await open();
            await db.query("UPDATE jobs SET application_deadline = NOW() - INTERVAL '2 days', decision_deadline = NOW() - INTERVAL '1 day' WHERE id = $1", [empty.id]);
            await jobs.updateJob(employer.id, empty.id, { applicationDeadline: new Date(Date.now() + 86400000), decisionDeadline: new Date(Date.now() + 3 * 86400000) });
            assert.equal((await jobs.getJobById(employer.id, 'employer', empty.id)).accountability.decisionDeadlineMissedAt, null);
        });
        await t.test('late resolution and cancellation capture missed deadlines before worker recovery', async () => {
            for (const action of ['withdraw', 'reject', 'accept', 'cancel'] as const) {
                const j = await open(); const a = await applicationAt(j.id, action === 'accept' ? 'offer' : 'applied');
                const oldDeadline = new Date(Date.now() - 3600000);
                await db.query("UPDATE jobs SET application_deadline = $2::timestamptz - INTERVAL '1 day', decision_deadline = $2 WHERE id = $1", [j.id, oldDeadline]);
                if (action === 'withdraw') await applications.withdrawApplication(candidate.id, a.id);
                if (action === 'reject') await applications.updateApplicationStatus(employer.id, a.id, { status: 'rejected' });
                if (action === 'accept') await applications.respondToOffer(candidate.id, a.id, { response: 'offer_accepted' });
                if (action === 'cancel') await jobs.cancelJob(employer.id, j.id, { reason: 'Requirement withdrawn after deadline' });
                assert.deepEqual((await jobs.getJobById(employer.id, 'employer', j.id)).accountability.decisionDeadlineMissedAt, oldDeadline, action);
            }
        });
        await t.test('terminal jobs reject deadline edits and worker scans leave their marker unchanged', async () => {
            for (const status of ['filled', 'cancelled']) {
                const j = await open(); await applications.applyToJob(candidate.id, j.id);
                // Simulate pre-existing terminal history with an unresolved row.
                await db.query("UPDATE jobs SET status = $2, application_deadline = NOW() - INTERVAL '2 days', decision_deadline = NOW() - INTERVAL '1 day' WHERE id = $1", [j.id, status]);
                await assert.rejects(() => jobs.updateJob(employer.id, j.id, { decisionDeadline: new Date(Date.now() + 3 * 86400000) }), /JOB_NOT_EDITABLE/);
                await missed.markMissedDecisionDeadlines();
                assert.equal((await jobs.getJobById(employer.id, 'employer', j.id)).accountability.decisionDeadlineMissedAt, null);
            }
        });
        await t.test('profiles, saved jobs, company roles, and notification ownership', async () => {
            await candidates.updateCandidateProfile(candidate.id, { headline: 'Engineer', skillIds: [skillRows.rows[0].id] });
            await candidates.updateCandidateProfile(candidate.id, { summary: 'Recruitment focused summary' });
            assert.equal((await candidates.getCandidateProfile(candidate.id))?.skills.length, 1);
            const j = await open(); await candidates.saveJob(candidate.id, j.id); await candidates.saveJob(candidate.id, j.id);
            await jobs.updateJobStatus(employer.id, j.id, { status: 'applications_closed' });
            assert.equal((await candidates.listSavedJobs(candidate.id, { page: 1, limit: 20 })).jobs[0].status, 'applications_closed');
            await candidates.unsaveJob(candidate.id, j.id);
            await companies.addRecruiter(employer.id, company.id, outsider.id);
            await assert.rejects(() => companies.updateCompany(outsider.id, company.id, { name: 'Recruiter cannot edit' }), /COMPANY_OWNER_REQUIRED/);
            const one = await notifications.getUserNotifications(candidate.id, { page: 1, limit: 1 });
            assert.equal(one.notifications.length, 1); assert.ok(one.pagination.total > 1);
            await assert.rejects(() => notifications.markNotificationAsRead(second.id, one.notifications[0].id), /NOTIFICATION_NOT_FOUND/);
        });
        await t.test('duplicate active postings are rejected, terminal history allows repost', async () => {
            const title = `Duplicate role ${++sequence}`;
            const first = await open({ title }); const duplicate = await draft({ title });
            await assert.rejects(() => jobs.publishJob(employer.id, duplicate.id), /DUPLICATE_ACTIVE_JOB/);
            await jobs.cancelJob(employer.id, first.id, { reason: 'Requirement withdrawn for this cycle' });
            await jobs.publishJob(employer.id, duplicate.id);
        });
        await t.test('identical jobs in different companies are allowed', async () => {
            const title = `Cross-company role ${++sequence}`;
            await open({ title });
            const otherCompany = await companies.createCompany(employer.id, { name: 'Independent company' });
            const other = await draft({ title, companyId: otherCompany.id });
            await jobs.publishJob(employer.id, other.id);
            assert.equal((await jobs.getJobById(employer.id, 'employer', other.id)).status, 'open');
        });
        await t.test('published content collisions roll back and valid edits refresh content_hash', async () => {
            const first = await open(); const editable = await open();
            const before = (await db.query('SELECT * FROM jobs WHERE id = $1', [editable.id])).rows[0];
            const changesBefore = (await db.query('SELECT * FROM job_change_events WHERE job_id = $1', [editable.id])).rows;
            await assert.rejects(() => jobs.updateJob(employer.id, editable.id, { title: first.title }), /DUPLICATE_ACTIVE_JOB/);
            assert.deepEqual((await db.query('SELECT * FROM jobs WHERE id = $1', [editable.id])).rows[0], before);
            assert.deepEqual((await db.query('SELECT * FROM job_change_events WHERE job_id = $1', [editable.id])).rows, changesBefore);
            const title = `Valid published edit ${++sequence}`;
            await jobs.updateJob(employer.id, editable.id, { title });
            const after = (await db.query('SELECT content_hash FROM jobs WHERE id = $1', [editable.id])).rows[0];
            assert.notEqual(after.content_hash, before.content_hash); assert.match(after.content_hash, /^[a-f0-9]{64}$/);
            const duplicate = await draft({ title });
            await assert.rejects(() => jobs.publishJob(employer.id, duplicate.id), /DUPLICATE_ACTIVE_JOB/);
        });
        await t.test('repost lineage does not bypass active duplicate protection', async () => {
            const original = await open();
            await jobs.cancelJob(employer.id, original.id, { reason: 'Ended first hiring cycle' });
            const input = { applicationDeadline: new Date(Date.now() + 86400000), decisionDeadline: new Date(Date.now() + 172800000) };
            const first = await jobs.repostJob(employer.id, original.id, input);
            await jobs.publishJob(employer.id, first.id);
            const blocked = await jobs.repostJob(employer.id, original.id, input);
            await assert.rejects(() => jobs.publishJob(employer.id, blocked.id), /DUPLICATE_ACTIVE_JOB/);
            assert.equal((await jobs.getJobById(employer.id, 'employer', blocked.id)).status, 'draft');
        });
        await t.test('opening reduction versus concurrent offer preserves capacity', async () => {
            const j = await open({ openings: 2 }); await applicationAt(j.id, 'offer');
            const pending = await applicationAt(j.id, 'final_review', second.id);
            const results = await Promise.allSettled([jobs.updateJob(employer.id, j.id, { openings: 1 }), applications.updateApplicationStatus(employer.id, pending.id, { status: 'offer' })]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
            assert.match((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, /^(OPENINGS_BELOW_OCCUPIED_CAPACITY|NO_OPENINGS_AVAILABLE)$/);
            const summary = await db.query("SELECT j.openings, COUNT(*) FILTER (WHERE a.status IN ('offer', 'offer_accepted'))::int AS occupied FROM jobs j JOIN applications a ON a.job_id = j.id WHERE j.id = $1 GROUP BY j.id", [j.id]);
            assert.ok(summary.rows[0].occupied <= summary.rows[0].openings);
        });
        await t.test('cancellation versus offer acceptance has one consistent outcome', async () => {
            const j = await open(); const a = await applicationAt(j.id, 'offer');
            const results = await Promise.allSettled([jobs.cancelJob(employer.id, j.id, { reason: 'Requirement withdrawn concurrently' }), applications.respondToOffer(candidate.id, a.id, { response: 'offer_accepted' })]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
            assert.match((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, /^(ACCEPTED_OFFER_EXISTS|APPLICATION_NOT_IN_OFFER_STAGE)$/);
            const row = (await db.query('SELECT j.status AS job_status, a.status FROM jobs j JOIN applications a ON a.job_id = j.id WHERE a.id = $1', [a.id])).rows[0];
            assert.ok((row.job_status === 'cancelled' && row.status === 'job_cancelled') || (row.job_status === 'open' && row.status === 'offer_accepted'));
        });
        await t.test('fill versus cancellation preserves accepted applications', async () => {
            const j = await open(); const a = await applicationAt(j.id, 'offer_accepted');
            await jobs.updateJobStatus(employer.id, j.id, { status: 'applications_closed' });
            await jobs.updateJobStatus(employer.id, j.id, { status: 'hiring_in_progress' });
            const results = await Promise.allSettled([jobs.updateJobStatus(employer.id, j.id, { status: 'filled' }), jobs.cancelJob(employer.id, j.id, { reason: 'Concurrent cancellation attempt' })]);
            assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
            assert.match((results[1] as PromiseRejectedResult).reason.message, /^(JOB_NOT_CANCELLABLE|ACCEPTED_OFFER_EXISTS)$/);
            assert.equal((await jobs.getJobById(employer.id, 'employer', j.id)).status, 'filled');
            assert.equal((await applications.getCandidateApplicationById(candidate.id, a.id)).status, 'offer_accepted');
        });
        await t.test('concurrent duplicate applications create a single application', async () => {
            const j = await open();
            const results = await Promise.allSettled([applications.applyToJob(candidate.id, j.id), applications.applyToJob(candidate.id, j.id)]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
            assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, 'ALREADY_APPLIED');
            assert.equal((await db.query('SELECT 1 FROM applications WHERE job_id = $1', [j.id])).rowCount, 1);
        });
        await t.test('concurrent identical publishes are serialized', async () => {
            const title = `Concurrent duplicate ${++sequence}`;
            const a = await draft({ title }); const b = await draft({ title });
            const results = await Promise.allSettled([jobs.publishJob(employer.id, a.id), jobs.publishJob(employer.id, b.id)]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
            assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, 'DUPLICATE_ACTIVE_JOB');
        });
        await t.test('resume ownership boundary and single active PDF replacement', async () => {
            const objects = new Map<string, Buffer>();
            const storage: ResumeStorage = { configured: true, put: async (key, value) => { objects.set(key, value); },
                get: async key => { const value = objects.get(key); assert.ok(value); return value; }, delete: async key => { objects.delete(key); } };
            const pdf = Buffer.from('%PDF-1.7\nexample\n%%EOF');
            await resumes.replaceResume(candidate.id, 'resume.pdf', pdf, 'application/pdf', storage);
            await resumes.replaceResume(candidate.id, 'updated.pdf', pdf, 'application/pdf', storage);
            assert.equal(objects.size, 1); assert.equal((await resumes.getResumeMetadata(candidate.id))?.filename, 'updated.pdf');
            const j = await open(); const a = await applications.applyToJob(candidate.id, j.id);
            const unrelated = await auth.registerUser({ firstName: 'Unrelated', lastName: 'Employer', email: 'unrelated@example.test', password: 'password123', role: 'employer' });
            await assert.rejects(() => resumes.readApplicationResume(unrelated.id, a.id, storage), /APPLICATION_ACCESS_DENIED/);
            assert.deepEqual((await resumes.readApplicationResume(employer.id, a.id, storage)).content, pdf);
            const active = await applications.getEmployerApplicationById(employer.id, a.id);
            assert.equal(active.candidate.profile?.headline, 'Engineer'); assert.equal(active.resume?.filename, 'updated.pdf');
            for (const status of ['withdrawn', 'rejected', 'offer_declined', 'offer_accepted', 'job_cancelled']) {
                await db.query('UPDATE applications SET status = $2 WHERE id = $1', [a.id, status]);
                const historical = await applications.getEmployerApplicationById(employer.id, a.id);
                assert.equal(historical.candidate.profile, null, status); assert.equal(historical.resume, null, status);
                assert.ok(historical.timeline.length > 0);
                await assert.rejects(() => resumes.readApplicationResume(employer.id, a.id, storage), /RESUME_NOT_FOUND/);
                assert.deepEqual((await resumes.readOwnResume(candidate.id, storage)).content, pdf);
            }

            await resumes.deleteResume(candidate.id, storage); assert.equal(objects.size, 0);
        });
    } finally {
        await apiPool?.end(); await workerPool?.end(); await db.end(); await admin.end();
        console.log(`Local test schema retained for inspection: ${schema}`);
    }
});
