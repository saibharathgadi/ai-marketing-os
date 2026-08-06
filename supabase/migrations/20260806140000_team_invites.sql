-- Team/role invite flow. organization_members.role has existed since
-- the multi-tenant migration but was schema-only: no invite UI, no
-- write policy at all on this table, and every signup always creates
-- a brand-new personal org. This migration adds the pieces needed for
-- an owner to invite a teammate by email, deliberately scoped so a
-- second user only ever joins an EXISTING org via a fresh signup that
-- matches a pending invite -- no multi-org membership/switching is
-- introduced anywhere.

-- auth.users isn't exposed to PostgREST, so the member list needs the
-- email denormalized directly onto organization_members rather than a
-- service-role round trip just to show who's on the team.
alter table public.organization_members
  add column if not exists email text;

update public.organization_members om
set email = u.email
from auth.users u
where u.id = om.user_id and om.email is null;

alter table public.organization_members
  alter column email set not null;

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  -- Fixed to 'member' in v1 -- no role picker, promoting to co-owner
  -- is a bigger trust decision, deferred.
  role text not null default 'member' check (role in ('member')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'revoked')
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Prevents duplicate pending invites for the same email within an org.
create unique index if not exists organization_invites_org_email_pending_unique_idx
on public.organization_invites (org_id, lower(email))
where status = 'pending';

create index if not exists organization_invites_org_id_status_idx
on public.organization_invites (org_id, status);

alter table public.organization_invites enable row level security;

-- Mirrors get_my_org_ids()'s existing precedent (security definer to
-- avoid RLS recursion) for an "is the caller an owner of this org"
-- check, needed because the new organization_members DELETE policy
-- below has to check the caller's own role in the very table it's a
-- policy on.
create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org_id
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

drop policy if exists "org owners can select invites" on public.organization_invites;
create policy "org owners can select invites"
on public.organization_invites for select
to authenticated
using (
  public.is_org_owner(org_id)
);

drop policy if exists "org owners can insert invites" on public.organization_invites;
create policy "org owners can insert invites"
on public.organization_invites for insert
to authenticated
with check (
  public.is_org_owner(org_id)
);

drop policy if exists "org owners can delete invites" on public.organization_invites;
create policy "org owners can delete invites"
on public.organization_invites for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- organization_members has had SELECT-only policies until now --
-- nothing (not even an owner) could add/remove a member. This is the
-- first write policy: owners can remove a MEMBER row (never an owner
-- row) from their own org.
drop policy if exists "org owners can remove members" on public.organization_members;
create policy "org owners can remove members"
on public.organization_members for delete
to authenticated
using (
  role = 'member'
  and public.is_org_owner(org_id)
);

-- Extended, not replaced: on every signup, first look for a pending,
-- non-expired invite matching the new user's email. If found, add
-- them to THAT org as 'member' instead of creating a personal org --
-- this is what keeps the single-org-per-user invariant true even with
-- invites in the picture. Otherwise, fall back to the exact original
-- behavior (new org, 'owner').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  matched_invite record;
begin
  select * into matched_invite
  from public.organization_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then

    insert into public.organization_members (org_id, user_id, role, email)
    values (matched_invite.org_id, new.id, matched_invite.role, new.email);

    update public.organization_invites
    set status = 'accepted'
    where id = matched_invite.id;

  else

    insert into public.organizations (name)
    values (coalesce(new.email, 'My') || '''s Organization')
    returning id into new_org_id;

    insert into public.organization_members (org_id, user_id, role, email)
    values (new_org_id, new.id, 'owner', new.email);

  end if;

  return new;
end;
$$;
