# Architecture

## Overview

AI Marketing OS is a Next.js (App Router) application that crawls a website,
scores its SEO health with deterministic rules, optionally enriches that
score with AI-generated insights, and persists the result to Supabase for
historical tracking and reporting.

```
Browser
  │
  ├─ POST /api/analyze ──────────────┐
  ├─ GET  /api/monitored-websites    │
  ├─ POST /api/monitored-websites    │
  ├─ POST /api/monitored-websites/run-all
  ├─ GET  /api/run-scheduled-audits (cron-secret protected)
  ├─ GET  /api/audit/[id] (dashboard reads Supabase directly, client-side)
  └─ GET  /api/report/[id]  and  /api/report/[id]/email
```

## Audit lifecycle

```
enqueueAudit(url)                         src/utils/auditQueue.ts
  │  URL validation + per-URL lock + bounded concurrency queue
  ▼
crawlWebsite(url)                         src/utils/crawler.ts
  │  loadPage(homepage) via fetchWithSsrfProtection
  │  analyzePage()                        src/utils/analyzer.ts (deterministic scoring)
  │  generateAIRecommendations()          src/utils/aiRecommendations.ts (deterministic, NOT an LLM call)
  │  analyzeTechnicalSeo()                src/utils/technicalSeo.ts (robots.txt/sitemap/canonical/OG/Twitter/schema)
  │  mapWithConcurrency over internal links → repeat per sub-page
  │  generateSiteSummary()                src/utils/summary.ts
  │  createAuditRecord() + persistCrawledPages() → Supabase `audits` / `crawled_pages`
  ▼
generateAndPersistAuditInsights()         src/utils/aiCopilot.ts
  │  Calls OpenAI (gpt-4o-mini) if OPENAI_API_KEY is set, else deterministic fallback
  │  Persists to audits.ai_insights (jsonb)
  ▼
updateMonitoredWebsiteDiagnostics()       src/utils/monitoredWebsiteDiagnostics.ts
  │  Updates monitored_websites.last_* columns
  ▼
JSON response → dashboard re-render
```

## Scheduled / bulk audits

`runMonitoredWebsiteAudits()` (`src/utils/runMonitoredWebsiteAudits.ts`) runs
every saved monitored website through the same `enqueueAudit` path, then
checks each site's two most recent audits for a Warning/Critical regression
and sends an alert email (`sendSeoRegressionAlertEmail`) if the site has a
`notification_email` configured. Two HTTP entry points share this one
function so they can't drift apart:

- `GET /api/run-scheduled-audits` — gated by `CRON_SECRET`, meant for an
  external scheduler. **There is currently no actual cron/scheduler
  configured anywhere in this repo** (no `vercel.json`, no external cron
  job) — this endpoint is only ever invoked by the manual button below
  unless you wire up a scheduler yourself.
- `POST /api/monitored-websites/run-all` — no secret required, this is what
  the dashboard's "Run Scheduled Audits" button calls directly from the
  browser.

## Data access pattern

All reads/writes — from API routes **and** directly from client components
(`src/app/dashboard/DashboardClient.tsx`, `src/app/audit/[id]/page.tsx`) —
go through a single Supabase client instantiated with the **anon key**
(`src/lib/supabase.ts`). There is no service-role key configured. Whether
this is safe depends entirely on the Row Level Security policies on your
Supabase tables — verify this directly in your Supabase project; it cannot
be confirmed from the repo alone.

## Auth (exists, but not enforced)

`src/app/login/LoginForm.tsx` and `src/components/Navbar.tsx` implement real
Supabase email/password sign-up, sign-in, and logout. However, there is no
`middleware.ts` and no call to `supabase.auth.getUser()`/`getSession()`
anywhere in the codebase — nothing gates `/`, `/dashboard`,
`/audit/[id]`, or any API route behind a session check. Treat this as fully
public until that's addressed.

## Schema management

There is no migrations directory or Supabase CLI migration history.
`database-index-recommendations.sql` is a hand-run SQL file listing
`alter table ... add column if not exists ...` statements and index
recommendations — the closest thing to a schema changelog this project has.
Because of this, most read/write paths defensively detect a "missing
column" Postgres error and fall back to a smaller payload
(`src/utils/schemaCompat.ts`'s `isMissingColumnError`), so the app keeps
working even if a given environment's schema is a few columns behind.

## AI layer

Two distinct things are both loosely called "AI" in this codebase:

1. **Per-page "AI recommendations"** (`src/utils/aiRecommendations.ts`) —
   despite the name, this is 100% deterministic if/else logic keyed off
   detected issue strings. No LLM call. This is intentional and matches
   the project's own principle that "AI should explain deterministic
   results," but the naming can mislead a future contributor into thinking
   it's calling out to OpenAI per page (which would be a real cost/latency
   problem if someone "fixed" it that way).
2. **Audit-level "AI insights"** (`src/utils/aiCopilot.ts`) — this one
   actually calls OpenAI, with `generateFallbackInsights` as a fully
   deterministic fallback when `OPENAI_API_KEY` is unset or the call fails.

## Queue system

`src/utils/auditQueue.ts` is a hand-rolled in-process job queue using
`globalThis` for state. It provides:

- A per-URL lock (no two concurrent crawls of the same URL, *within one
  process*)
- A bounded concurrency + queue-depth limit

Because the state lives in `globalThis`, it does **not** coordinate across
multiple serverless instances — under real horizontal scaling, two
instances can each accept and run a crawl for the same URL concurrently.
`src/utils/rateLimit.ts` has the identical limitation for the same reason.

## Directory map

```
src/
  app/
    api/                     Route handlers (see list above)
    audit/[id]/page.tsx      Server component — single audit detail + regression view
    dashboard/
      page.tsx               Thin server wrapper (metadata only)
      DashboardClient.tsx     Actual dashboard UI ("use client")
    login/
      page.tsx               Thin server wrapper (metadata only)
      LoginForm.tsx           Actual login/signup UI ("use client")
    page.tsx                 Homepage — ad-hoc single-URL audit form
  components/
    DashboardCharts.tsx       Trend charts + regression summary (scoped to one site's history)
    MonitoredWebsites.tsx     Saved-website CRUD + manual audit trigger
    Navbar.tsx
    ui/                       shadcn-generated primitives (Radix-based)
  lib/
    supabase.ts               Anon-key Supabase client (shared client + server)
    date.ts, utils.ts
  utils/
    crawler.ts                 Core crawl orchestration
    analyzer.ts                 Deterministic SEO scoring
    aiRecommendations.ts        Deterministic per-page "recommendations"
    aiCopilot.ts                 Real OpenAI call + fallback + persistence
    technicalSeo.ts               robots.txt/sitemap/schema checks
    seoRegression.ts               Audit-to-audit regression analysis
    summary.ts                      Site summary aggregation
    auditQueue.ts, rateLimit.ts       In-process concurrency/rate limiting
    urlValidation.ts                  SSRF-safe URL validation + redirect-safe fetch
    runMonitoredWebsiteAudits.ts       Shared "run every monitored site" orchestration
    monitoredWebsiteDiagnostics.ts      Per-site last-run diagnostics persistence
    schemaCompat.ts                     Shared "missing column" detection
    emailReport.ts, pdfReport.ts         Resend + pdf-lib report generation
```
