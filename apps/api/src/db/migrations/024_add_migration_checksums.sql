-- Bookkeeping changes are versioned too. Existing applied filenames are
-- baselined once by the runner; historical SQL is not executed again.
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
