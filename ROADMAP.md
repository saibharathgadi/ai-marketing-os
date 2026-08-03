# Roadmap

Ordered by engineering dependency and value-per-effort, not by feature
excitement. Each phase assumes the previous one is done — building
Billing before Organizations exist, for example, has nothing to attach a
subscription to.

## Now — landing page & anonymous teaser audit

Ahead of Phase 1, in progress: a real marketing landing page (the
current `/` is the audit tool itself, not a landing page), a header
that shows "Run Audit" + "Login" for anonymous visitors, and an
anonymous teaser flow — an unauthenticated visitor's "Run Audit" crawls
a page or two and shows a partial preview, then gates the full report
behind login/signup. Not part of the original phase ordering above;
tracked here since it touches the same auth/routing surface as Phase 0.

## Phase 0 — Foundation (blocks everything below)

1. ~~**Authentication enforcement**~~ — done. `middleware.ts` gates every
   private route/page behind a session check.
2. ~~**Organizations**~~ — done. `organizations`/`organization_members`
   tables exist, every core table (`monitored_websites`, `audits`,
   `crawled_pages`) is `org_id`-scoped with RLS enforcing it, and a new
   user auto-provisions a personal org on signup (email or Google).
3. **Teams & role-based permissions** — schema groundwork only. The
   `organization_members.role` column supports `owner`/`member`, but
   there's no invite flow and no route actually branches on role yet —
   still open.
4. ~~**Database migrations**~~ — done. `supabase/migrations/` has real,
   source-controlled, timestamped migrations (baseline schema,
   multi-tenant, RLS recursion fix, content items, campaigns).
5. **Background workers** — still open. `auditQueue.ts`/`rateLimit.ts`
   still use `globalThis` for state, which won't coordinate across
   multiple serverless instances.

Also already done, ahead of where this list originally expected:
a real cron scheduler (`vercel.json` → `/api/run-scheduled-audits` daily),
so "scheduled audits" now actually run on a timer, not just on manual
click.

## Phase 1 — Monetization

6. **Stripe billing** — plans, subscriptions, checkout, webhooks.
7. **Usage tracking** — audits run, pages crawled, emails sent per org.
8. **AI credits** — meter OpenAI usage per org; needed before any
   AI-heavy Content Studio / Copilot feature ships, or usage costs are
   unbounded per customer.

## Phase 2 — Extend the existing SEO engine (highest synergy)

These reuse the crawler, scoring engine, and dashboard that already exist
— the cheapest features to build well.

9. **Brand profiles** — company name, industry, tone, target audience;
   becomes the shared context every AI feature after this point reads
   from (Content Studio, Copilot, Ads).
10. **Keyword tracking** — natural extension of the existing SEO audit
    data.
11. **Competitor tracking** — reuses the crawler against competitor URLs.
12. **SERP monitoring** — requires picking a third-party SERP data
    provider; scope that decision before building.
13. **Analytics dashboard improvements** — extend `DashboardCharts` with
    org-scoped, multi-site views now that tenancy exists (this is also
    where the current single-site trend-chart limitation gets a proper
    fix: a site selector across an org's monitored websites).

## Phase 3 — Content & Advertising

14. ~~**Content Studio**~~ — done (`content_items` table + API routes +
    `/content` page, saving straight from audit copilot output). Built
    without a brand-profile step (Phase 2 item 9 doesn't exist yet), so
    generation context is per-audit, not yet org-wide brand context —
    worth revisiting once Brand Profiles ships.
15. **Content Planner** — still open (calendar/scheduling UI on top of
    Content Studio's output).
16. **Advertising generation** — partially done. `campaigns`/`ad_sets`
    tables + API routes + Campaign Builder page exist, generating
    campaign/ad-set copy and structure from audit data. No actual ad
    platform API integration (Google/Meta/LinkedIn) — copy/structure
    generation only, as the original "or generating copy/structure only"
    fallback scope.
17. **Creative Generator** (marketing images) — still open; needs an
    image-generation provider decision.

## Phase 4 — Differentiation

18. **AI Marketing Copilot** — partially exists in a narrower form: each
    audit has an AI copilot tab (`aiCopilot.ts`, grounded research,
    root-cause tables, roadmap/KPIs) scoped to that one audit. The
    roadmap's original vision — one assistant with context across
    competitors, keywords, and brand profile too — still needs those
    Phase 2 data sources before it can expand beyond per-audit scope.
19. **Marketing Automation** — chained workflows (e.g. weekly audit →
    report → blog → social posts → email → notify). Built on top of the
    background-worker infrastructure from Phase 0.

## Phase 5 — Go-to-market features

20. **Client Portal** — a second user role (client vs. account owner);
    builds directly on Organizations/Teams from Phase 0.
21. **White-label support** — reuses the existing `pdfReport.ts`/
    `emailReport.ts` infrastructure almost as-is; strong fit for agency
    customers once billing exists.
22. **Enterprise features** (SSO, audit logs, custom contracts, etc.) —
    last, once there's a paying customer base large enough to need them.

## Notes

- Don't build a feature module before its prerequisites in an earlier
  phase — the ordering above exists specifically to avoid rework (e.g.
  building Content Studio before Brand Profiles means redoing its
  context-passing later; building the Copilot before Keyword
  Tracking/Competitor Intelligence exist means it can't actually assist
  with those yet).
- Re-evaluate this ordering once Phase 0 ships — real usage data from
  early customers may reorder Phases 2–4 based on what they actually ask
  for first.
