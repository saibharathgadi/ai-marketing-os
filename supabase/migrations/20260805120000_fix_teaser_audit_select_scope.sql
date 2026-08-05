-- Fix: the original anon-teaser-audits policy granted SELECT "to public"
-- (both anon and authenticated roles) on any org_id IS NULL row, with no
-- per-row scoping. Since Postgres ORs every applicable RLS policy
-- together for the same operation, this meant an authenticated user's
-- own "list my org's audits" dashboard query also picked up every
-- anonymous teaser audit system-wide, not just their own org's rows.
-- Users then tried to delete one of these, the delete policy correctly
-- refused (org_id is never "in" their org list when it's null), the
-- delete silently affected zero rows, and the row reappeared on the
-- next dashboard load, looking exactly like "deleting doesn't work."
--
-- Restricting these policies to the anon role only fixes the leak.
-- Trade-off: a logged-in user opening a raw teaser-audit link directly
-- will now see the "log in to view this audit" fallback even though
-- they're signed in, since neither policy matches for them on an
-- org-less row. Accepted as a rare edge case versus leaking every
-- teaser audit into every authenticated user's audit list.

drop policy if exists "anyone can select teaser audits" on public.audits;
drop policy if exists "anon can select teaser audits" on public.audits;
create policy "anon can select teaser audits"
on public.audits for select
to anon
using (org_id is null);

drop policy if exists "anyone can select teaser crawled_pages" on public.crawled_pages;
drop policy if exists "anon can select teaser crawled_pages" on public.crawled_pages;
create policy "anon can select teaser crawled_pages"
on public.crawled_pages for select
to anon
using (
  audit_id in (
    select id from public.audits where org_id is null
  )
);
