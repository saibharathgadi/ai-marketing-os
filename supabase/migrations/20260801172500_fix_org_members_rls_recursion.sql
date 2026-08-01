-- Fixes infinite recursion in the "members can view org teammates" RLS
-- policy from the multi_tenant migration. That policy's USING clause ran
-- a subquery against organization_members from within a policy defined
-- ON organization_members — Postgres re-applies RLS to the subquery's
-- own table access, which re-triggers the same policy, forever
-- ("infinite recursion detected in policy for relation
-- organization_members", Postgres error 42P17).
--
-- Since this policy is transitively queried by monitored_websites/
-- audits/crawled_pages' own policies (they all check org membership via
-- organization_members), this recursion broke nearly every RLS-protected
-- read in the app once the multi-tenant migration went live.
--
-- Standard fix: a SECURITY DEFINER helper function. It runs as its
-- owner (which bypasses RLS on tables it owns), so its internal query
-- against organization_members does not re-trigger RLS — breaking the
-- recursion. It only ever returns rows for auth.uid(), so it can't leak
-- another user's membership data despite running with elevated
-- privileges.

create or replace function public.get_my_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.organization_members where user_id = auth.uid()
$$;

drop policy if exists "members can view org teammates" on public.organization_members;
create policy "members can view org teammates"
on public.organization_members for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);
