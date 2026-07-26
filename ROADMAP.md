# Roadmap

Ordered by engineering dependency and value-per-effort, not by feature
excitement. Each phase assumes the previous one is done — building
Billing before Organizations exist, for example, has nothing to attach a
subscription to.

## Phase 0 — Foundation (blocks everything below)

1. **Authentication enforcement** — session checks in middleware/routes;
   currently login exists but nothing is gated behind it.
2. **Organizations** — the first multi-tenant primitive; every other
   table needs an `org_id` to hang off of.
3. **Teams & role-based permissions** — owner/admin/member roles within
   an organization.
4. **Database migrations** — replace the hand-run SQL recommendations
   file with real, source-controlled migrations before the schema grows
   further with org/team/billing tables.
5. **Background workers** — replace the in-memory queue with a durable
   job system before adding more heavy async features (keyword tracking,
   competitor monitoring) that would only compound the current
   in-memory-state fragility.

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

14. **Content Studio** (blogs, landing pages, social captions, etc.) —
    the first genuinely new AI generation surface; needs its own prompt
    design, brand-profile integration, and cost control via AI credits.
15. **Content Planner** — calendar/scheduling UI on top of Content
    Studio's output.
16. **Advertising generation** (Google/Meta/LinkedIn campaigns, ad sets,
    creatives) — highest scope item in this phase; needs a decision on
    which ad platform APIs (if any) to integrate versus generating
    copy/structure only.
17. **Creative Generator** (marketing images) — needs an image-generation
    provider decision; keep scoped to marketing assets, not a general
    image editor.

## Phase 4 — Differentiation

18. **AI Marketing Copilot** — an assistant with context across website,
    competitors, keywords, historical audits, campaigns, content, and
    brand profile. Deliberately last among the AI features — it needs
    all of Phases 2–3's data to actually have something to reason over;
    building it earlier would just produce a chatbot with nothing real
    to say.
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
