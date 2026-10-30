-- Quick Preview request idempotency for SQLite/Turso.
-- PRE-FLIGHT REQUIRED: run the duplicate check below against the configured Turso DB
-- before applying this migration. Do not run against Hatchable PostgreSQL.
--
-- SELECT json_extract(analysis_json, '$.quick_preview_request_id') AS request_id,
--        COUNT(*) AS row_count
-- FROM jobs
-- WHERE json_extract(analysis_json, '$.quick_preview_request_id') IS NOT NULL
-- GROUP BY json_extract(analysis_json, '$.quick_preview_request_id')
-- HAVING COUNT(*) > 1;
--
-- If the pre-flight returns any rows, stop and manually reconcile those saved
-- applications first. Do not delete records automatically: they may be user data.
-- After the check returns no rows, apply this partial unique index. It prevents
-- concurrent requests with the same non-empty idempotency key from creating
-- duplicate jobs while leaving ordinary jobs unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_quick_preview_request_id
ON jobs (json_extract(analysis_json, '$.quick_preview_request_id'))
WHERE json_extract(analysis_json, '$.quick_preview_request_id') IS NOT NULL;