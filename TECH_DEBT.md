# Technical Debt

Tracked, known gaps — not urgent bugs, but real debt that should be paid
down before this becomes a multi-tenant SaaS product. See
`PRODUCTION_CHECKLIST.md` for the production-readiness gate items and
`ROADMAP.md` for feature sequencing.

## Critical (blocks multi-tenant SaaS)

- **No authentication enforcement.** Login/signup/logout work
  (`src/app/login/LoginForm.tsx`), but nothing checks a session anywhere —
  no `middleware.ts`, no `supabase.auth.getUser()` call in any route or
  page. Every audit, every monitored website, and every API route is fully
  public. There is also no `user_id`/`org_id` on any table — the data model
  itself has no concept of ownership yet.
- **Row Level Security state is unverified.** The app uses only the anon
  key (`src/lib/supabase.ts`), including from client components that query
  Supabase directly. Whether this is safe depends entirely on your
  Supabase project's RLS policies — verify this directly in Supabase; it
  is not something the repo can confirm on its own.

## High

- **No real scheduler wired up.** "Scheduled audits" only run when someone
  clicks the dashboard button (`POST /api/monitored-websites/run-all`) or
  when an external caller hits `GET /api/run-scheduled-audits` with the
  cron secret. There is no `vercel.json` cron config or any other
  automation actually calling it on a timer.
- **In-memory queue/rate-limiter don't survive horizontal scaling.**
  `src/utils/auditQueue.ts` and `src/utils/rateLimit.ts` both use
  `globalThis` for state, which is per-process. Under real multi-instance
  serverless deployment, the same URL can be crawled concurrently by two
  instances, and rate limits reset per cold start / aren't shared.
- **No database migrations.** Schema changes are tracked only in
  `database-index-recommendations.sql`, a hand-run SQL file, not a real
  migration history. This is the direct cause of the "missing column"
  fallback logic scattered through the codebase — real migrations would
  let that defensive code be deleted entirely.
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
