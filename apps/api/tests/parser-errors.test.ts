import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { apiErrorHandler } from '../src/middleware/error.middleware.js';

test('known parser failures use client statuses and stable message responses', () => {
    for (const [type, status] of [
        ['entity.parse.failed', 400], ['entity.too.large', 413],
        ['charset.unsupported', 415], ['encoding.unsupported', 415],
    ] as const) {
        let actualStatus: number | undefined;
        let body: unknown;
        const res = { status(code: number) { actualStatus = code; return this; }, json(value: unknown) { body = value; return this; } };
        apiErrorHandler({ type }, {} as Request, res as Response, () => {});
        assert.equal(actualStatus, status);
        assert.deepEqual(Object.keys(body as object), ['message']);
    }
});
test('unrelated server errors cannot impersonate parser client statuses', () => {
    for (const error of [new Error('database failure'), { status: 415 }, { type: 'unknown', status: 400 }, null]) {
        let actualStatus: number | undefined;
        const res = { status(code: number) { actualStatus = code; return this; }, json() { return this; } };
        apiErrorHandler(error, {} as Request, res as Response, () => {});
        assert.equal(actualStatus, 500);
    }
});
