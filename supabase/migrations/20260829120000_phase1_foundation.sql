-- Phase 1 foundation: workspace-scoped third-party OAuth credentials,
-- named competitors per workspace, and the Opportunity Engine's central
-- table. Also closes five missing-index gaps identified during the Phase 1
-- planning audit.

-- integration_connections -----------------------------------------------
-- Workspace-scoped OAuth credentials, generic across providers (GSC and
-- GA4 first; any future provider reuses this same table/shape). RLS is
-- deliberately service-role-only, with zero policies for authenticated/
-- anon -- the same pattern already used for rate_limit_counters and the
-- audit_queue_* tables. Tokens are application-layer encrypted (see
-- src/utils/tokenEncryption.ts) before being written here, so even a
-- direct service-role read returns ciphertext, not a usable token -- but
-- the stronger guarantee is that no authenticated/anon Postgres role can
-- read this table at all, so a token can never reach a browser via a
-- normal session-client query, encrypted or not.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('google_search_console', 'google_analytics')),
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scope text,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

alter table public.integration_connections enable row level security;

create index if not exists integration_connections_org_id_idx
on public.integration_connections (org_id);

-- competitors --------------------------------------------------------------
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  name text,
  created_at timestamptz not null default now()
);

alter table public.competitors enable row level security;

drop policy if exists "org members can select their competitors" on public.competitors;
create policy "org members can select their competitors"
on public.competitors for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert their competitors" on public.competitors;
create policy "org members can insert their competitors"
on public.competitors for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update their competitors" on public.competitors;
create policy "org members can update their competitors"
on public.competitors for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete their competitors" on public.competitors;
create policy "org members can delete their competitors"
on public.competitors for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

create index if not exists competitors_org_id_idx
on public.competitors (org_id);

-- opportunities --------------------------------------------------------------
-- The Opportunity Engine's central entity. Created now as an empty
-- skeleton per the Phase 1 spec -- populated starting Phase 2, once real
-- GSC/GA4/competitor data exists to generate opportunities from. The
-- optional references let an opportunity cite the real evidence it was
-- built from (the Evidence Layer's "Evidence" stage), rather than storing
-- only free-text.
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  impact text check (impact in ('low', 'medium', 'high')),
  difficulty text check (difficulty in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'dismissed')),
  tracked_keyword_id uuid references public.tracked_keywords (id) on delete set null,
  competitor_id uuid references public.competitors (id) on delete set null,
  content_item_id uuid references public.content_items (id) on delete set null,
  evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;

drop policy if exists "org members can select their opportunities" on public.opportunities;
create policy "org members can select their opportunities"
on public.opportunities for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert their opportunities" on public.opportunities;
create policy "org members can insert their opportunities"
on public.opportunities for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update their opportunities" on public.opportunities;
create policy "org members can update their opportunities"
on public.opportunities for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete their opportunities" on public.opportunities;
create policy "org members can delete their opportunities"
on public.opportunities for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

create index if not exists opportunities_org_id_idx
on public.opportunities (org_id);

-- Five missing indexes identified during the Phase 1 planning audit --------
create index if not exists landing_page_briefs_campaign_id_idx
on public.landing_page_briefs (campaign_id);

create index if not exists landing_page_briefs_org_id_idx
on public.landing_page_briefs (org_id);

create index if not exists campaigns_audit_id_idx
on public.campaigns (audit_id);

create index if not exists tracked_keywords_monitored_website_id_idx
on public.tracked_keywords (monitored_website_id);

create index if not exists organization_invites_invited_by_idx
on public.organization_invites (invited_by);
