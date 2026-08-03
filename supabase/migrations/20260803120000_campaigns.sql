-- Phase 3: Campaign Builder — first-class campaigns and ad sets with a real
-- foreign-key relationship (campaigns already had a flat, name-string-only
-- "link" to ad sets via content_items in Phase 2). audit_id is on delete
-- set null (not cascade) and site_url is copied at save time, matching
-- content_items' convention so deleting the source audit never deletes a
-- saved campaign.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  audit_id uuid references public.audits (id) on delete set null,
  site_url text,
  name text not null,
  objective text,
  target_audience text,
  key_message text,
  channels text[] not null default '{}',
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'completed')
  ),
  budget numeric,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Denormalized to match the parent campaign's org_id, so RLS stays a flat
  -- org_id check with no join — same tradeoff content_items already made.
  org_id uuid not null references public.organizations (id) on delete cascade,
  audience_angle text,
  creative_angle text,
  suggested_budget_split text,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'completed')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_org_id_created_at_idx
on public.campaigns (org_id, created_at desc);

create index if not exists campaigns_org_id_status_idx
on public.campaigns (org_id, status);

create index if not exists ad_sets_campaign_id_idx
on public.ad_sets (campaign_id);

create index if not exists ad_sets_org_id_idx
on public.ad_sets (org_id);

alter table public.campaigns enable row level security;
alter table public.ad_sets enable row level security;

drop policy if exists "org members can select campaigns" on public.campaigns;
create policy "org members can select campaigns"
on public.campaigns for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert campaigns" on public.campaigns;
create policy "org members can insert campaigns"
on public.campaigns for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update campaigns" on public.campaigns;
create policy "org members can update campaigns"
on public.campaigns for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete campaigns" on public.campaigns;
create policy "org members can delete campaigns"
on public.campaigns for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can select ad_sets" on public.ad_sets;
create policy "org members can select ad_sets"
on public.ad_sets for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert ad_sets" on public.ad_sets;
create policy "org members can insert ad_sets"
on public.ad_sets for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update ad_sets" on public.ad_sets;
create policy "org members can update ad_sets"
on public.ad_sets for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete ad_sets" on public.ad_sets;
create policy "org members can delete ad_sets"
on public.ad_sets for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);
