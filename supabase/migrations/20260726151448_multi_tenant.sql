-- Multi-tenancy: organizations, membership, and org-scoping of existing
-- tables. See ARCHITECTURE.md for the reasoning — every audit and
-- monitored website now belongs to an organization, and access is
-- enforced by Row Level Security, not just application code.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists organization_members_user_id_idx
on public.organization_members (user_id);

-- org_id on the tables that previously had no tenant scoping at all.
alter table public.monitored_websites
add column if not exists org_id uuid references public.organizations (id) on delete cascade;

alter table public.audits
add column if not exists org_id uuid references public.organizations (id) on delete cascade;

-- The old global unique(url) index doesn't make sense once two
-- different organizations can each monitor the same URL independently.
drop index if exists public.monitored_websites_url_unique_idx;

create unique index if not exists monitored_websites_org_id_url_unique_idx
on public.monitored_websites (org_id, url);

create index if not exists monitored_websites_org_id_idx
on public.monitored_websites (org_id);

create index if not exists audits_org_id_created_at_idx
on public.audits (org_id, created_at desc);

-- Every new user gets a personal organization automatically, so there's
-- no manual "create your org" step for v1. security definer so it can
-- write to organizations/organization_members regardless of the
-- (not-yet-existing) session's RLS visibility.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name)
  values (coalesce(new.email, 'My') || '''s Organization')
  returning id into new_org_id;

  insert into public.organization_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.monitored_websites enable row level security;
alter table public.audits enable row level security;
alter table public.crawled_pages enable row level security;

drop policy if exists "members can view own membership" on public.organization_members;
create policy "members can view own membership"
on public.organization_members for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can view org teammates" on public.organization_members;
create policy "members can view org teammates"
on public.organization_members for select
to authenticated
using (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "members can view their orgs" on public.organizations;
create policy "members can view their orgs"
on public.organizations for select
to authenticated
using (
  id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "owners can update their org" on public.organizations;
create policy "owners can update their org"
on public.organizations for update
to authenticated
using (
  id in (
    select org_id from public.organization_members
    where user_id = auth.uid() and role = 'owner'
  )
);

drop policy if exists "org members can select monitored_websites" on public.monitored_websites;
create policy "org members can select monitored_websites"
on public.monitored_websites for select
to authenticated
using (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can insert monitored_websites" on public.monitored_websites;
create policy "org members can insert monitored_websites"
on public.monitored_websites for insert
to authenticated
with check (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can update monitored_websites" on public.monitored_websites;
create policy "org members can update monitored_websites"
on public.monitored_websites for update
to authenticated
using (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
)
with check (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can delete monitored_websites" on public.monitored_websites;
create policy "org members can delete monitored_websites"
on public.monitored_websites for delete
to authenticated
using (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can select audits" on public.audits;
create policy "org members can select audits"
on public.audits for select
to authenticated
using (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can insert audits" on public.audits;
create policy "org members can insert audits"
on public.audits for insert
to authenticated
with check (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can delete audits" on public.audits;
create policy "org members can delete audits"
on public.audits for delete
to authenticated
using (
  org_id in (
    select org_id from public.organization_members where user_id = auth.uid()
  )
);

drop policy if exists "org members can select crawled_pages" on public.crawled_pages;
create policy "org members can select crawled_pages"
on public.crawled_pages for select
to authenticated
using (
  audit_id in (
    select id from public.audits
    where org_id in (
      select org_id from public.organization_members where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can delete crawled_pages" on public.crawled_pages;
create policy "org members can delete crawled_pages"
on public.crawled_pages for delete
to authenticated
using (
  audit_id in (
    select id from public.audits
    where org_id in (
      select org_id from public.organization_members where user_id = auth.uid()
    )
  )
);

-- Deliberately no "authenticated" insert/update policy on audits.update,
-- crawled_pages.insert/update, or monitored_websites diagnostics writes:
-- those are written by trusted server-side code using the service-role
-- client (crawler.ts, monitoredWebsiteDiagnostics.ts, aiCopilot.ts),
-- which bypasses RLS entirely and is never exposed to the browser.
