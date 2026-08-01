-- Baseline schema migration.
--
-- This adopts the schema that was previously managed by hand through
-- database-index-recommendations.sql into real, source-controlled
-- migrations. Written defensively (if not exists / if exists) since it
-- may run against a database that already has some or all of these
-- objects from that earlier manual process.

create table if not exists public.monitored_websites (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  last_audited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  average_score integer not null,
  total_pages integer not null,
  total_issues integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.crawled_pages (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  url text not null,
  title text,
  meta_description text,
  h1s text[],
  h2s text[],
  seo_score integer not null,
  word_count integer not null,
  issues text[],
  ai_recommendations text,
  created_at timestamptz not null default now()
);

alter table public.audits
add column if not exists crawl_duration_ms integer,
add column if not exists crawl_status text,
add column if not exists crawl_failure_reason text,
add column if not exists is_slow boolean not null default false,
add column if not exists ai_insights jsonb,
add column if not exists technical_seo jsonb;

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
