# Production Readiness Checklist

Status as of the last engineering review. See `TECH_DEBT.md` for the
detailed writeup behind each unchecked item.

## Security

- [x] SSRF protection on the crawler (private/loopback/metadata-IP
      blocklist, including IPv4-mapped IPv6 literals; every redirect hop
      re-validated, not just the initial URL)
- [x] Rate limiting on audit-triggering and email-sending routes
- [x] Cron endpoint fails closed in production when `CRON_SECRET` is unset
- [x] No raw Postgres/PostgREST error messages leaked to API callers
- [x] No `dangerouslySetInnerHTML` / XSS vector anywhere (verified —
      React's default escaping covers all rendered crawl content)
- [x] No secrets committed to the repo (`.env.local` is gitignored)
- [ ] **Authentication enforcement** — login exists but nothing checks a
      session; every route and page is fully public
- [ ] **Row Level Security verified** — depends on your live Supabase
      project's policies, not confirmable from the repo alone
- [ ] DNS-rebinding protection for the crawler (hostname-based SSRF
      blocking can't catch a domain that resolves to an internal IP;
      closing this needs DNS-pinning in the fetch layer)
- [ ] Security headers (CSP, `X-Frame-Options`, etc.) in `next.config.ts`

## Data & Reliability

- [x] Deterministic SEO scoring engine, no flakiness
- [x] Audit-record insert failures roll back the crawled-pages insert
      correctly (no orphaned rows on partial failure)
- [x] Regression comparisons are scoped per-website, not mixed across
      different monitored sites
- [ ] **Database migrations** — schema changes are tracked only in a
      hand-run SQL file, not real migration history
- [ ] **Queue/rate-limiter durability** — in-memory (`globalThis`) state
      doesn't coordinate across multiple serverless instances
- [ ] Real scheduler wired up (no `vercel.json` cron / external scheduler
      configured — "scheduled audits" currently only run on manual
      trigger)

## Code Quality

- [x] TypeScript `strict: true`, zero `any`/`@ts-ignore`/unsafe casts
      anywhere in the codebase
- [x] ESLint clean
- [x] No dead code from `generateSiteSummary`/`sendSeoRegressionAlertEmail`
      (now wired in)
- [x] No unused dependencies (`lighthouse`, `chrome-launcher`,
      `@supabase/auth-helpers-nextjs`, `tw-animate-css` removed)
- [ ] Automated tests (none exist yet)
- [ ] Prettier / `.editorconfig` for formatting consistency

## UX

- [x] Loading, empty, and error states present on all major views
- [x] Skeleton loaders on the dashboard's audit list
- [x] Private pages (`/dashboard`, `/login`, `/audit/[id]`) marked
      `robots: noindex`
- [x] Icon-only controls have accessible names
- [ ] Full accessibility pass (keyboard navigation, focus states, color
      contrast) not yet done
- [ ] Pagination on the dashboard's audit list

## Ops

- [x] `npm run lint`, `npm run typecheck`, `npm run build` all pass
- [x] Next.js patched to the latest security-fixed release in its minor
      line
- [ ] Error reporting / observability (Sentry or equivalent) — none
      configured
- [ ] Structured logging — currently plain `console.log`/`console.error`
- [ ] Uptime/health-check monitoring
