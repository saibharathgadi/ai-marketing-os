# API Reference

All routes are Next.js App Router route handlers under `src/app/api/`.
None currently require authentication (see `TECH_DEBT.md`) unless noted.

## `POST /api/analyze`

Runs an ad-hoc audit of an arbitrary URL — the homepage form. Rate
limited (6 requests/minute per IP). Runs the crawl through the shared
queue, generates AI insights, and returns the full audit result inline
(does not require the audit to have been persisted first).

**Body:** `{ "url": "https://example.com" }`

**Responses:** `200` with `{ success: true, data, aiInsights, queue }` on
success. `400` invalid URL, `409` a crawl for this URL is already running,
`429` rate limited, `503` queue full.

## `GET /api/monitored-websites`

Lists all saved monitored websites, most recently created first.

## `POST /api/monitored-websites`

Saves a new monitored website.

**Body:** `{ "url": "https://example.com", "notificationEmail"?: "you@example.com" }`

`notificationEmail` is optional; if set, a Warning/Critical SEO
regression detected on a scheduled/bulk run will email an alert there.

## `DELETE /api/monitored-websites/[id]`

Removes a monitored website by id.

## `POST /api/monitored-websites/run-all`

Runs an audit for every saved monitored website. This is what the
dashboard's "Run Scheduled Audits" button calls — no secret required
(rate limited instead, 3 requests/minute per IP). See
`GET /api/run-scheduled-audits` below for the automated-caller
counterpart.

## `GET /api/run-scheduled-audits`

Identical behavior to `POST /api/monitored-websites/run-all`, but
intended for an external scheduler (there is currently no scheduler
actually configured — see `TECH_DEBT.md`). Requires `CRON_SECRET` as
either an `Authorization: Bearer <secret>` header or `x-cron-secret`
header. If `CRON_SECRET` is unset, this fails closed (401) in
production and is open in development.

## `GET /api/audit/[id]`

Not a route handler — reserved path shape used by the dashboard link;
audit detail is rendered server-side at `/audit/[id]` (a page, not an
API route).

## `DELETE /api/audit/[id]`

Deletes an audit and its crawled pages. Fails if either delete fails
(no partial-delete state left behind).

## `GET /api/report/[id]`

Streams a generated PDF report for the given audit id as
`application/pdf`.

## `POST /api/report/[id]/email`

Emails the same PDF report to a recipient via Resend. Rate limited (5
requests/minute per IP).

**Body:** `{ "to": "recipient@example.com" }`

## `GET /api/diagnostics`

Returns the in-process audit queue's current snapshot (`active`,
`queued`, `failed`, `failedByReason`, etc.). Polled by the dashboard
every 2 seconds while the tab is visible.
