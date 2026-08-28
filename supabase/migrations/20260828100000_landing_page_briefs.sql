-- Landing page brief generator, tied to a campaign. content_items and
-- campaigns have always been entirely unlinked -- this is the exact same
-- problem ad_sets already solved once before (a flat, name-string-only
-- link in Phase 2, replaced by a real FK'd table in Phase 3). Applying
-- the identical fix here: a dedicated table with a campaign_id FK,
-- rather than retrofitting content_items (which serves 8 unrelated
-- types) with a campaign-specific column.

create table if not exists public.landing_page_briefs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Denormalized copy of the parent campaign's org_id, same as
  -- ad_sets.org_id -- keeps RLS a flat check with no join needed.
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  target_offer text not null,
  sections jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'ready')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.landing_page_briefs enable row level security;

drop policy if exists "org members can select their landing page briefs" on public.landing_page_briefs;
create policy "org members can select their landing page briefs"
on public.landing_page_briefs for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert their landing page briefs" on public.landing_page_briefs;
create policy "org members can insert their landing page briefs"
on public.landing_page_briefs for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update their landing page briefs" on public.landing_page_briefs;
create policy "org members can update their landing page briefs"
on public.landing_page_briefs for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete their landing page briefs" on public.landing_page_briefs;
create policy "org members can delete their landing page briefs"
on public.landing_page_briefs for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);
