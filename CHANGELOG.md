# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
This project doesn't cut versioned releases yet, so entries are grouped by
engineering session instead of a version number.

## Unreleased

### Fixed

- Next.js patched from 16.2.6 to 16.2.12, resolving a disclosed
  "unauthenticated disclosure of internal Server Function endpoints"
  advisory (GHSA-955p-x3mx-jcvp).
- Dashboard regression/trend detection compared the two most-recently
  created audits site-wide, producing meaningless comparisons whenever
  more than one website was monitored. Now scoped per-website, matching
  the audit detail page's existing correct behavior.
- The cron-secret-protected `/api/run-scheduled-audits` endpoint was also
  being called directly from the dashboard's "Run Scheduled Audits"
  button with no auth header, so the button broke whenever the secret was
  configured. Split into the cron endpoint (unchanged) plus a new
  rate-limited `POST /api/monitored-websites/run-all` for the button.
- `crawled_pages` delete errors were silently ignored before deleting the
  parent audit, risking orphaned rows on partial failure.
- SSRF: fixed an IPv4-mapped IPv6 literal bypass in URL validation (e.g.
  `http://[::ffff:169.254.169.254]/`), and added redirect-hop validation
  so a malicious site can't 302 the crawler to an internal address.
- Scheduled/cron audits never generated or persisted AI insights — only
  the manual analyze path did.
- Raw Postgres/PostgREST error messages were being returned to API
  callers in several routes.
- Rate-limit key derivation now prefers the non-spoofable
  `x-vercel-forwarded-for` header over client-controlled
  `x-forwarded-for`/`x-real-ip`.
- Cron endpoint now fails closed (not open) in production when
  `CRON_SECRET` is unset.

### Added

- `sendSeoRegressionAlertEmail` (fully built, previously never called)
  is now wired up: monitored websites can set an optional notification
  email, and a Warning/Critical regression on a scheduled/bulk audit run
  triggers the alert.
- `robots: { index: false, follow: false }` metadata on `/dashboard`,
  `/login`, and `/audit/[id]` — all private pages that were previously
  fully indexable.
- Skeleton loaders on the dashboard's audit list.
- `notification_email` column support on `monitored_websites` (degrades
  gracefully if the column isn't migrated yet, matching the existing
  schema-compat pattern).
- `npm run typecheck` script.
- `ARCHITECTURE.md`, `ROADMAP.md`, `TECH_DEBT.md`,
  `PRODUCTION_CHECKLIST.md`, this changelog, and a real `README.md`
  (previously the untouched `create-next-app` boilerplate).

### Changed

- Centralized five separate, near-identical "is this Postgres error a
  missing column" implementations into one shared
  `src/utils/schemaCompat.ts` helper.
- `crawler.ts` now calls the existing `generateSiteSummary()` utility
  instead of duplicating the same reduce logic inline (the utility was
  defined but never used).
- Diagnostics polling on the dashboard now pauses while the tab is
  hidden and refreshes immediately when it becomes visible again,
  instead of polling every 2 seconds unconditionally.

### Removed

- Unused dependencies: `lighthouse`, `chrome-launcher`,
  `@supabase/auth-helpers-nextjs`, `tw-animate-css` — none were imported
  anywhere in `src/`. Moved `shadcn` (a codegen CLI) to
  `devDependencies`.

## Earlier

- Initial SEO crawler, deterministic scoring, technical SEO checks,
  historical audits, scheduled-audit trigger, queue system with
  diagnostics, rate limiting, URL validation, PDF/email reporting,
  dashboard, regression detection, and the two-tier AI insights pipeline
  (OpenAI + deterministic fallback) were built prior to this changelog's
  start.
