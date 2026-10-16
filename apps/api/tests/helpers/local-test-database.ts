// Do not import database configuration or dotenv here. Validate before any Pool
// is constructed. libpq-style URL parameters can override node-postgres hosts.
export function localTestDatabaseUrl(value: string): URL {
    let url: URL;
    try { url = new URL(value); }
    catch { throw new Error('TEST_DATABASE_URL must be an explicit local PostgreSQL URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.hash || !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname)) {
        throw new Error('Tests require localhost, 127.0.0.1, or ::1 and a dedicated *_test database');
    }
    // No URL query options are necessary for the input. In particular, reject
    // host/hostaddr, service, options, and encoded/case-varied overrides. The
    // harness supplies its own search_path only after validation.
    if (url.search || value.includes('?')) throw new Error('TEST_DATABASE_URL must not contain query parameters');
    url.searchParams.set('sslmode', 'disable');
    return url;
}
