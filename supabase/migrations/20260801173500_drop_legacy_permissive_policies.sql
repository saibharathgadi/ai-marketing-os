-- Drops leftover permissive RLS policies from the pre-multi-tenant era
-- of this app (created "by hand" per baseline_schema.sql's comment,
-- before the org-scoped policies existed). These use role `public` and
-- `qual: true` / `with_check: true` — i.e. "always allow, to anyone,
-- authenticated or not". Postgres OR's multiple permissive policies for
-- the same command together, so these silently bypassed every org-scoped
-- policy added later: any authenticated (or anonymous) caller could
-- read every organization's audits/crawled_pages, and fully
-- read/write/delete every organization's monitored_websites.
--
-- Confirmed via a live test: a brand-new user with zero organization
-- membership could see all 18 audit rows across every organization
-- before this fix.

drop policy if exists "Allow select for audits" on public.audits;
drop policy if exists "Allow delete audits" on public.audits;
drop policy if exists "Allow inserts for audits" on public.audits;

drop policy if exists "Allow select for crawled pages" on public.crawled_pages;
drop policy if exists "Allow delete crawled pages" on public.crawled_pages;
drop policy if exists "Allow inserts for crawled pages" on public.crawled_pages;

drop policy if exists "Allow all monitored websites" on public.monitored_websites;
