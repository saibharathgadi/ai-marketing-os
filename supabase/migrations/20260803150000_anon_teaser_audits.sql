-- Anonymous teaser audits: an unauthenticated "Run Audit" click on the
-- landing page crawls 1-2 pages and stores an audit with org_id = null
-- (already nullable — see multi_tenant.sql). These policies let ANY
-- viewer — anonymous or logged in ("public" covers both roles) — read
-- back ONLY org-less rows, so a teaser link still works if someone
-- forwards it after signing in, while no existing org-scoped data
-- becomes newly readable.

drop policy if exists "anyone can select teaser audits" on public.audits;
create policy "anyone can select teaser audits"
on public.audits for select
to public
using (org_id is null);

drop policy if exists "anyone can select teaser crawled_pages" on public.crawled_pages;
create policy "anyone can select teaser crawled_pages"
on public.crawled_pages for select
to public
using (
  audit_id in (
    select id from public.audits where org_id is null
  )
);
