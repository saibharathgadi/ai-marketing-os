# Architecture

## Overview

Verolyx (`ai-marketing-os`) is a multi-tenant Next.js (App Router) application
that crawls a website, scores its SEO/AEO/AIO/GEO health with deterministic
rules, enriches that with AI-generated insights, and persists the result to
Supabase for historical tracking, reporting, and downstream content/campaign
generation. Every tenant is an `organizations` row (a "workspace"); a user
belongs to one or more organizations via `organization_members`.

```
Browser
  │
  ├─ POST /api/analyze ────────────────────┐
  ├─ GET/POST /api/monitored-websites      │
  ├─ POST /api/monitored-websites/run-all  │
  ├─ GET  /api/run-scheduled-audits (Vercel cron, CRON_SECRET-protected)
  ├─ GET  /api/run-scheduled-keyword-checks (Vercel cron, CRON_SECRET-protected)
  ├─ GET  /api/audit/[id] (dashboard/audit pages read Supabase directly, client-side, RLS-scoped)
  ├─ GET  /api/report/[id], /api/report/[id]/email, /api/report/[id]/llms-txt
  ├─ /api/content-items, /api/campaigns, /api/ad-sets, /api/landing-page-briefs
  ├─ /api/brand-profile, /api/team, /api/billing/*, /api/webhooks/stripe
  └─ /api/diagnostics (authenticated; returns aggregate, non-tenant-scoped queue health)
```

## Audit lifecycle

```
enqueueAudit(url, orgId)                  src/utils/auditQueue.ts
  │  URL validation (including DNS-resolved IP checks) + a durable
  │  Postgres-backed per-(org,url) lock (audit_queue_jobs) + rate limiting
  ▼
crawlWebsite(url, orgId)                  src/utils/crawler.ts
  │  Multi-page crawl via sitemap discovery + internal-link BFS
  │  (fetchWithSsrfProtection, 60-page/45s budget, concurrency 5)
  │  analyzePage()                        src/utils/analyzer.ts (deterministic SEO scoring)
  │  generateAIRecommendations()          src/utils/aiRecommendations.ts (deterministic, NOT an LLM call)
  │  analyzeTechnicalSeo() + AEO/AIO/GEO  src/utils/technicalSeo.ts, answerEngineSeo.ts (all deterministic)
  │  generateSiteSummary()                src/utils/summary.ts
  │  createAuditRecord() + persistCrawledPages() → Supabase `audits` / `crawled_pages`
  ▼
generateAndPersistAuditInsights()         src/utils/aiCopilot.ts
  │  Gemini (primary, free tier) → OpenAI (fallback) → deterministic
  │  template fallback if neither provider is configured or both fail
  │  (src/utils/aiProvider.ts). Persists to audits.ai_insights (jsonb).
  │  Skipped entirely for anonymous/teaser audits to conserve AI quota.
  ▼
updateMonitoredWebsiteDiagnostics()       src/utils/monitoredWebsiteDiagnostics.ts
  │  Updates monitored_websites.last_* columns
  ▼
JSON response → dashboard / audit-detail re-render
```

## Scheduled / bulk audits

`runMonitoredWebsiteAudits()` (`src/utils/runMonitoredWebsiteAudits.ts`) runs
every org's saved monitored websites through the same `enqueueAudit` path,
then checks each site's two most recent audits for a regression and sends an
alert email if the site has a `notification_email` configured.

- `GET /api/run-scheduled-audits` and `GET /api/run-scheduled-keyword-checks`
  are registered as real Vercel Cron Jobs (see `vercel.json`) and gated by a
  shared-secret check against `CRON_SECRET`.
- `POST /api/monitored-websites/run-all` is the interactive equivalent,
  triggered from the dashboard's "Run Scheduled Audits" button, scoped to the
  calling user's own organization.

## Data access pattern

Reads/writes go through one of three Supabase client factories
(`src/lib/supabase/{client,server,service}.ts`):

- **Browser/server session clients** (anon key) — used by almost everything;
  safety depends entirely on Postgres Row Level Security, which is enabled
  on every table and enforced consistently (see "Multi-tenancy" below).
- **Service-role client** — used only from trusted server code that has
  already established the caller's identity/authorization itself (crawler
  writes, cron jobs, the Stripe webhook, OAuth token handling). Never
  imported from a `"use client"` file.

## Multi-tenancy & authorization

Every user gets a personal organization automatically via a `SECURITY
DEFINER` trigger (`handle_new_user`) on `auth.users` insert. Team invites
(`organization_invites`) let an existing org add a new signup instead.

RLS policy convention: newer tables (`content_items`, `campaigns`, `ad_sets`,
`tracked_keywords`, `keyword_checks`, `brand_profiles`, `landing_page_briefs`,
and beyond) use `org_id in (select public.get_my_org_ids())`, a
`SECURITY DEFINER` helper that avoids the RLS-recursion bug the earliest
tables (`organizations`, `organization_members`, `monitored_websites`,
`audits`, `crawled_pages`) worked around with hand-rolled inline subqueries
before the helper existed. Both forms are currently in use and functionally
equivalent; the helper is the pattern for all new tables.

**API routes**: a route that creates a resource explicitly resolves the
caller's org via `getCurrentOrgId()` (needed to stamp the new row); a route
that reads/updates/deletes a resource by id relies on RLS alone to scope the
result — this is a deliberate, uniform convention, not a per-route judgment
call.

**Page-level auth**: `src/lib/supabase/middleware.ts` fail-closed gates every
page under `protectedPagePrefixes` (`/campaigns`, `/content`, `/dashboard`,
`/keywords`, `/settings`) behind a session check, redirecting to `/login`.
`/`, `/login`, `/pricing`, `/blog`, and `/audit/[id]` are deliberately public
(the last one self-branches on `org_id === null` to serve a capped anonymous
teaser vs. the full detail view for the owning org).

## Schema management

`supabase/migrations/` is the single source of truth — a real, timestamped,
append-only migration history (no separate hand-run SQL file; that pattern
was retired). There is no declarative-schema folder and no generated
TypeScript types file; understanding a table's current shape means reading
its `CREATE TABLE` plus any later `ALTER TABLE` migrations in order.
`src/utils/schemaCompat.ts`'s `isMissingColumnError()` still exists as a
defensive fallback for a few older, frequently-patched columns — new tables
should not need this pattern.

## AI layer

Two distinct things are both loosely called "AI" in this codebase:

1. **Per-page "AI recommendations"** (`src/utils/aiRecommendations.ts`) —
   despite the name, this is 100% deterministic if/else logic keyed off
   detected issue strings. No LLM call. This is intentional, but the naming
   can mislead a future contributor into thinking it calls a provider.
2. **Audit-level "AI insights"** (`src/utils/aiCopilot.ts`) and every
   downstream generator (`creativeGenerator.ts`, `landingPageBriefGenerator.ts`,
   `faqSchemaGenerator.ts`) — these call `src/utils/aiProvider.ts`'s
   `generateStructuredJSON()`, which tries Gemini's free tier first, falls
   back to OpenAI if configured, and falls back to a hand-written
   deterministic template if both are unavailable or fail. Every result is
   tagged `source: "ai" | "fallback"` so the app itself can tell which path
   produced it.

SEO/AEO/AIO/GEO **scores** themselves (`analyzer.ts`, `answerEngineSeo.ts`)
are always deterministic, rule-based checks against real crawled data — never
an LLM estimate dressed as a score.

## Queue & rate limiting

Both are durable and Postgres-backed (`supabase/migrations/20260805130000_durable_rate_limit_and_audit_queue.sql`),
not in-process/`globalThis` state — they correctly coordinate across
concurrent Vercel serverless instances. `src/utils/rateLimit.ts`'s
`checkRateLimit()` calls an atomic `check_rate_limit()` Postgres RPC;
`src/utils/auditQueue.ts` uses a similar per-`(org, url)` lock row
(`audit_queue_jobs`) to prevent duplicate concurrent crawls.

## Directory map

```
src/
  app/
    api/                       Route handlers — see the request list above
    audit/[id]/page.tsx        Audit detail: scores, issues, AI Marketing Copilot tabs
    campaigns/                 Campaign Builder (campaigns, ad sets, landing briefs)
    content/                   Content Studio (saved AI-generated content ideas)
    dashboard/                 Overview/Analytics/Sites & Audits tabs
    keywords/                  Keyword/citation tracking
    settings/{brand,team,billing}/
    login/, auth/callback/     Auth (email/password + Google Identity Services)
    blog/, pricing/, page.tsx  Public marketing pages + anonymous teaser audit
  components/
    AuditCopilotTabs.tsx        The AI Marketing Copilot tabs (largest component)
    CampaignDialog.tsx, AdSetDialog.tsx, LandingPageBriefDialog.tsx
    ContentBoard.tsx, ContentItemCard.tsx, ContentItemDialog.tsx
    DashboardCharts.tsx, MonitoredWebsites.tsx
    Save{ToContentStudio,Campaign,AdSet}Button.tsx  Audit → other-module bridges
    ToastProvider.tsx, ThemeProvider.tsx, StatCard.tsx, Navbar.tsx
    ui/                         shadcn-style Radix primitives (button, dialog, select, toast, ...)
  lib/
    supabase/{client,server,service,middleware}.ts   The three client factories + auth middleware
    date.ts, utils.ts
  utils/
    crawler.ts, analyzer.ts, technicalSeo.ts, answerEngineSeo.ts   Deterministic analysis
    aiProvider.ts, aiCopilot.ts, aiRecommendations.ts               AI + the one deterministic exception
    creativeGenerator.ts, faqSchemaGenerator.ts, landingPageBriefGenerator.ts
    auditQueue.ts, rateLimit.ts                                     Durable, Postgres-backed
    urlValidation.ts                                                 SSRF-safe URL validation (incl. DNS resolution) + redirect-safe fetch
    organizations.ts, planLimits.ts                                  Multi-tenancy + plan gating
    emailReport.ts, pdfReport.ts, teamInviteEmail.ts                 Resend + pdf-lib
    schemaCompat.ts                                                  Legacy "missing column" defensive fallback
supabase/
  migrations/                  The schema's single source of truth (timestamped, append-only)
```
