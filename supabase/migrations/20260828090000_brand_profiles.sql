-- Brand Profiles. A small, optional per-org settings object so AI-generated
-- audit insights (content ideas, ad campaigns, blog series, etc.) can
-- reflect the org's actual voice and audience instead of generic copy
-- derived purely from crawled pages + competitor research.

create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  business_description text,
  target_audience text,
  tone_of_voice text,
  key_differentiators text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;

-- Any member of the org can view/edit -- matches content_items/campaigns,
-- not an owner-only surface like team management.
drop policy if exists "org members can select their brand profile" on public.brand_profiles;
create policy "org members can select their brand profile"
on public.brand_profiles for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert their brand profile" on public.brand_profiles;
create policy "org members can insert their brand profile"
on public.brand_profiles for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update their brand profile" on public.brand_profiles;
create policy "org members can update their brand profile"
on public.brand_profiles for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);
