-- Phase 2: Content Studio — persists AI-generated content ideas (blog
-- ideas, blog series, social ideas/series, ad campaigns, ad sets,
-- landing page ideas, keyword clusters) as standalone, editable
-- entities instead of being locked inside a single audit's
-- regenerated ai_insights jsonb blob. audit_id is on delete set null
-- (not cascade) and site_url is copied at save time, so deleting the
-- source audit never deletes anything saved here.

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  audit_id uuid references public.audits (id) on delete set null,
  site_url text,
  type text not null check (
    type in (
      'blog_idea',
      'blog_series',
      'social_idea',
      'social_series',
      'ad_campaign',
      'ad_set',
      'landing_page_idea',
      'keyword_cluster'
    )
  ),
  status text not null default 'idea' check (status in ('idea', 'drafted', 'published')),
  title text not null,
  body jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_org_id_created_at_idx
on public.content_items (org_id, created_at desc);

create index if not exists content_items_org_id_type_idx
on public.content_items (org_id, type);

create index if not exists content_items_audit_id_idx
on public.content_items (audit_id);

alter table public.content_items enable row level security;

drop policy if exists "org members can select content_items" on public.content_items;
create policy "org members can select content_items"
on public.content_items for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert content_items" on public.content_items;
create policy "org members can insert content_items"
on public.content_items for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update content_items" on public.content_items;
create policy "org members can update content_items"
on public.content_items for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete content_items" on public.content_items;
create policy "org members can delete content_items"
on public.content_items for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);
