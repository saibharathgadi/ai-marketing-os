-- Lightweight index recommendations for the AI Marketing OS Supabase schema.
-- Run these in Supabase SQL Editor after confirming the table names match production.
-- They are written as non-destructive ALTER TABLE ADD COLUMN IF NOT EXISTS
-- and CREATE INDEX IF NOT EXISTS statements.

alter table public.audits
add column if not exists crawl_duration_ms integer,
add column if not exists crawl_status text,
add column if not exists crawl_failure_reason text,
add column if not exists is_slow boolean not null default false,
add column if not exists ai_insights jsonb;

alter table public.monitored_websites
add column if not exists last_failure_reason text,
add column if not exists last_audit_duration_ms integer,
add column if not exists last_audit_status text,
add column if not exists last_audit_is_slow boolean not null default false,
add column if not exists notification_email text;

create index if not exists audits_created_at_idx
on public.audits (created_at desc);

create index if not exists audits_url_created_at_idx
on public.audits (url, created_at desc);

create index if not exists audits_crawl_status_created_at_idx
on public.audits (crawl_status, created_at desc);

create index if not exists audits_is_slow_created_at_idx
on public.audits (is_slow, created_at desc);

create index if not exists crawled_pages_audit_id_seo_score_idx
on public.crawled_pages (audit_id, seo_score desc);

create index if not exists monitored_websites_created_at_idx
on public.monitored_websites (created_at desc);

create unique index if not exists monitored_websites_url_unique_idx
on public.monitored_websites (url);
