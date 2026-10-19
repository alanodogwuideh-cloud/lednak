# Cloudflare Pages backend

This folder contains the Cloudflare-specific runtime. Hatchable continues to use the existing `api/` and `lib/` files. Do not replace or delete those files to make Cloudflare work.

## Entry point

Cloudflare Pages Advanced Mode uses `public/_worker.js` as the Worker entrypoint when `public/` is configured as the Pages build output directory. The worker dispatches `/api/*` to this module and sends non-API requests to the Pages Assets binding.

## Cloudflare Pages configuration

Connect the same GitHub repository that Hatchable pushes to. Set:
- Build command: leave empty for this static site
- Build output directory: `public`
- Deploy branch: the branch Hatchable pushes to
- Runtime mode: Pages Advanced Mode, using the checked-in `_worker.js`

Configure these as Cloudflare Pages environment variables/secrets. Never commit values:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `ADMIN_EMAIL`

The Supabase publishable key is browser-visible by design; the service-role key must remain server-side. Configure the same Turso database and R2 bucket used by the portfolio only after verifying the credentials and access policies.

## Resume Studio — Phase 1

The first Resume Studio slice is the private Master Profile editor inside the existing admin sidebar. It uses the existing Supabase Bearer-token admin check and the same Turso database as the portfolio. The profile is stored as validated JSON in `master_profile`; the initial schema migration is tracked in `lib/migrations/001_resume_studio_phase1.sql` and was applied directly to the configured Turso database. Do not apply this SQLite/Turso migration to Hatchable's separate Postgres database.

Implemented endpoints:
- `GET /api/admin-resume-profile` — authenticated profile load, with an empty template when no profile has been saved
- `PUT /api/admin-resume-profile` — authenticated, size-limited profile validation and upsert

The Cloudflare Pages router includes the endpoint in its protected route list. Jobs, resumes, and cover-letter navigation remain disabled until their phases are implemented.

## Resume publishing

The public portfolio's Resume/CV upload is managed separately in the About & site settings. It uses the existing `resume-pdf` route and is not part of the removed Resume Studio.

## Endpoint migration status

Implemented in the Cloudflare runtime:
- Public portfolio data: `GET /api/portfolio`
- Published case-study detail: `GET /api/case-study?slug=...`
- Favicon and about-image redirects
- Supabase admin-session validation and configuration
- Admin case-study listing, metadata CRUD, ordering, and move-to-trash
- Admin case-study section GET/POST/PUT/DELETE
- Admin portfolio settings GET/PUT/POST, profile image upload, favicon upload/reset
- Media listing, signed R2 uploads, finalize-upload, preview, metadata edits, and safe detach
- Duplicate case study with copied R2 media, with the copy created as a draft
- Trash listing, move-to-trash, restore, permanent delete, and empty trash with shared-media reference checks

Still required before production:
- End-to-end smoke tests for every CMS flow and response shape
- Configure and verify all Cloudflare environment secrets and Pages asset routing
- Verify Supabase auth settings and R2 CORS/presigned-upload behavior in a Cloudflare preview deployment

Do not deploy this backend as production CMS until the remaining endpoints are migrated and the smoke-test checklist passes. Hatchable remains unchanged and continues to use its original backend.