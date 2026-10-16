import assert from 'node:assert/strict';
import test from 'node:test';
import { localTestDatabaseUrl } from './helpers/local-test-database.js';

test('integration database guard accepts only explicit loopback test databases', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
        assert.equal(localTestDatabaseUrl(`postgresql://tester:password@${host}:5432/clearhire_test`).hostname, host);
    }
});
test('integration database guard rejects remote, overridden, and ambiguous connections', () => {
    for (const value of [
        'postgresql://db.example/clearhire_test', 'postgresql://ep-example.neon.tech/clearhire_test',
        'postgresql://localhost/clearhire', 'postgresql://localhost/clearhire%5ftest',
        'postgresql://127.1/clearhire_test', 'postgresql://localhost./clearhire_test',
        'postgresql://localhost/clearhire_test?host=remote.example',
        'postgresql://localhost/clearhire_test?%68ost=remote.example',
        'postgresql://localhost/clearhire_test?HOST=remote.example',
        'postgresql://localhost/clearhire_test?hostaddr=1.2.3.4',
        'postgresql://localhost/clearhire_test?service=production',
        'postgresql://localhost/clearhire_test?options=-c%20search_path%3Dpublic',
        'postgresql://localhost/clearhire_test?sslmode=disable',
        'postgresql://localhost/clearhire_test?', 'postgresql://localhost/clearhire_test#ignored',
        'file://localhost/clearhire_test', 'clearhire_test', '',
    ]) assert.throws(() => localTestDatabaseUrl(value), Error, value);
});
