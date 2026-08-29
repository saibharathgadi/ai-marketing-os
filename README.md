# Verolyx

An AI-powered SEO audit platform: crawl a website, score it against
deterministic SEO rules, get AI-generated insights on top of that score,
track it over time, and email/export a PDF report.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the pieces fit
together, [`TECH_DEBT.md`](./TECH_DEBT.md) for known gaps,
[`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) for readiness
status, and [`ROADMAP.md`](./ROADMAP.md) for what's planned next.

## Stack

- **Framework:** Next.js (App Router) + TypeScript, strict mode
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (implemented but not yet enforced — see
  `TECH_DEBT.md`)
- **Email:** Resend
- **AI:** OpenAI, with a fully deterministic fallback when no API key is
  configured
- **Deployment:** Vercel

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `OPENAI_API_KEY` | No | Enables real AI insight generation; falls back to deterministic insights if unset |
| `RESEND_API_KEY` | No | Required to actually send PDF/regression-alert emails |
| `RESEND_FROM_EMAIL` | No | Defaults to a Resend sandbox address |
| `CRON_SECRET` | Recommended in production | Protects `GET /api/run-scheduled-audits` from unauthenticated calls |
| `CRAWL_MAX_PAGES`, `CRAWL_PAGE_CONCURRENCY`, `CRAWL_SLOW_MS`, `CRAWL_QUEUE_CONCURRENCY`, `CRAWL_QUEUE_MAX_SIZE` | No | Tune crawl/queue behavior; all have sane defaults |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only — background jobs, OAuth token storage, rate limiting |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | No | Enables the Google Search Console / GA4 integrations under Settings → Integrations |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Required if the Google integrations are enabled | AES-256-GCM key OAuth refresh/access tokens are encrypted with at rest |
| `ADMIN_ALERT_EMAIL` | No | Where integration-failure and internal-usage-spike alert emails are sent (requires `RESEND_API_KEY`) |
| `MULTI_ORG_GATE_ORG_IDS` | No | Comma-separated org ids with multi-org (workspace switcher) support enabled during rollout — see `src/utils/organizations.ts` |

### Database schema

Migrations live in [`supabase/migrations`](./supabase/migrations) and
are applied by hand via the Supabase SQL editor (or the Supabase CLI, if
installed) — there's no automated migration-apply step in the deploy
pipeline yet. Apply them in filename order.

## Scripts

```bash
npm run dev         # start the dev server
npm run build        # production build
npm run start        # run a production build
npm run lint          # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # vitest — runs against the real Supabase project (see vitest.config.ts)
```

## Known limitations

Before treating this as a production multi-tenant SaaS, read
`TECH_DEBT.md` in full — in short: authentication exists but is not
enforced anywhere, there's no real scheduler wired up for "scheduled"
audits, the in-process queue/rate-limiter won't coordinate across
multiple serverless instances, and there are no automated tests yet.
