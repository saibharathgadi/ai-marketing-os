# AI Marketing OS

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

### Database schema

There's no migration tooling yet — run
[`database-index-recommendations.sql`](./database-index-recommendations.sql)
in the Supabase SQL editor to add the optional diagnostic/notification
columns and recommended indexes. The app degrades gracefully if a column
from that file hasn't been applied yet (see `src/utils/schemaCompat.ts`).

## Scripts

```bash
npm run dev         # start the dev server
npm run build        # production build
npm run start        # run a production build
npm run lint          # ESLint
npm run typecheck      # tsc --noEmit
```

## Known limitations

Before treating this as a production multi-tenant SaaS, read
`TECH_DEBT.md` in full — in short: authentication exists but is not
enforced anywhere, there's no real scheduler wired up for "scheduled"
audits, the in-process queue/rate-limiter won't coordinate across
multiple serverless instances, and there are no automated tests yet.
