-- Existing rows have NULL hashes and remain intact. Publishing/editing computes
-- hashes and checks legacy active content under a company row lock as well.
CREATE UNIQUE INDEX idx_jobs_active_company_content_unique
ON jobs(company_id, content_hash)
WHERE content_hash IS NOT NULL
  AND status IN ('open', 'applications_closed', 'hiring_in_progress');
