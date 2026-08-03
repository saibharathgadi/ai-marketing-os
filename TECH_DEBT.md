# Technical Debt

Tracked, known gaps — not urgent bugs, but real debt that should be paid
down before this becomes a multi-tenant SaaS product. See
`PRODUCTION_CHECKLIST.md` for the production-readiness gate items and
`ROADMAP.md` for feature sequencing.

## Resolved since last review

- **Authentication enforcement** — `middleware.ts` now gates every
  private route/page behind a session check via `supabase.auth.getUser()`.
- **Organizations / ownership model** — `organizations`,
  `organization_members` tables exist; `monitored_websites`, `audits`,
  `crawled_pages` are all `org_id`-scoped.
- **Row Level Security** — confirmed enabled (`alter table ... enable row
  level security`) with real org-scoped policies on every core table in
  `supabase/migrations/20260726151448_multi_tenant.sql`. A recursion bug
  in the "view org teammates" policy was found and fixed via a
  `SECURITY DEFINER` helper function
  (`20260801172500_fix_org_members_rls_recursion.sql`).
- **Database migrations** — `supabase/migrations/` now holds real,
  source-controlled, timestamped migrations. The
  `database-index-recommendations.sql` hand-run file is legacy at this
  point.
- **Scheduler** — `vercel.json` has a real cron
  (`0 3 * * *` → `/api/run-scheduled-audits`) — scheduled audits now run
  on a timer, not just on manual dashboard click.

## Critical (blocks multi-tenant SaaS)

- **Teams & role-based permissions are schema-only.**
  `organization_members.role` supports `owner`/`member`, but there's no
  invite flow (no UI, no API route) and nothing in the app actually
  branches on role — anyone in an org has identical access today.

## High

- **In-memory queue/rate-limiter don't survive horizontal scaling.**
  `src/utils/auditQueue.ts` and `src/utils/rateLimit.ts` both use
  `globalThis` for state, which is per-process. Under real multi-instance
  serverless deployment, the same URL can be crawled concurrently by two
  instances, and rate limits reset per cold start / aren't shared.
- **Zero automated tests.** No test runner configured, no test files. The
  deterministic scoring/regression logic (`analyzer.ts`, `seoRegression.ts`)
  is pure and easily testable but has no coverage at all.

## Medium

- `generateAIRecommendations` (`src/utils/aiRecommendations.ts`) is a
  misleading name — it's fully deterministic, not an LLM call. Intentional
  by design (see `ARCHITECTURE.md`), but worth renaming/documenting so a
  future contributor doesn't assume otherwise.
- `generateAndPersistAuditInsights` always passes `regressions: []` to the
  AI context, even though real regression analysis exists
  (`seoRegression.ts`). The `regressionExplanation` field in every AI
  insight is therefore always generic fallback text — the AI never
  actually explains a real detected regression despite the data being
  available.
- No pagination on the dashboard's audit list (`.limit(100)`) — once you
  exceed 100 total audits across all monitored sites, older history
  silently disappears with no indication.
- `npm audit` reports vulnerabilities nested inside `next`'s own vendored
  `postcss`/`sharp` and `shadcn`'s vendored `hono`/MCP SDK. Both require a
  breaking downgrade to "fix" per npm's own suggestion (e.g. `next@9.3.3`),
  which would be far worse than the vulnerabilities themselves. Monitor for
  upstream Next.js/shadcn releases that bump these internal dependencies
  rather than forcing a downgrade.

## Low / cosmetic

- No Prettier or `.editorconfig` — formatting consistency currently relies
  on ESLint alone.
- PDF reports strip all non-ASCII characters (`pdfReport.ts`'s
  `cleanText`) — a constraint of `pdf-lib`'s standard fonts. Non-English
  website titles/content render as blank spaces. Fixable by embedding a
  Unicode-capable font if internationalized sites become a priority.
- No security headers configured in `next.config.ts` (CSP,
  `X-Frame-Options`, etc.). Low urgency since there's no
  `dangerouslySetInnerHTML` or other XSS vector in the app today
  (verified), but worth adding as defense-in-depth.
- Client-side URL validation on the homepage (`src/app/page.tsx`) is a
  simplified reimplementation of the server-side `validateWebsiteUrl` — no
  private-IP checks client-side. Not a security issue (server re-validates
  before crawling), just an inconsistent UX (a generic server error instead
  of instant client feedback for e.g. `localhost`).
