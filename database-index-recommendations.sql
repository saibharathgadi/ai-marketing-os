-- Lightweight index recommendations for the AI Marketing OS Supabase schema.
-- Run these in Supabase SQL Editor after confirming the table names match production.
-- They are written as non-destructive CREATE INDEX IF NOT EXISTS statements.

create index if not exists audits_created_at_idx
on public.audits (created_at desc);

create index if not exists audits_url_created_at_idx
on public.audits (url, created_at desc);

create index if not exists crawled_pages_audit_id_seo_score_idx
on public.crawled_pages (audit_id, seo_score desc);

create index if not exists monitored_websites_created_at_idx
on public.monitored_websites (created_at desc);

create unique index if not exists monitored_websites_url_unique_idx
on public.monitored_websites (url);
