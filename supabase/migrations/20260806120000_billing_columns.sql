-- Billing columns for Stripe subscriptions. One subscription per org
-- (single Pro tier, no seats), so these live directly on organizations
-- rather than a separate subscriptions table. `plan` and
-- `subscription_status` are deliberately free text with no CHECK
-- constraint / no enum: a future third tier or a new Stripe status
-- value needs no migration, just a new PLAN_LIMITS entry in app code.
alter table public.organizations
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists plan_updated_at timestamptz;

create unique index if not exists organizations_stripe_customer_id_idx
on public.organizations (stripe_customer_id)
where stripe_customer_id is not null;

create index if not exists organizations_stripe_subscription_id_idx
on public.organizations (stripe_subscription_id)
where stripe_subscription_id is not null;

-- SECURITY: the existing "owners can update their org" RLS policy
-- (20260726151448_multi_tenant.sql) is a row-level USING clause only --
-- it does not restrict which columns an owner can update. Without this
-- revoke/grant, any org owner could self-upgrade with a single
-- supabase-js call: supabase.from('organizations').update({ plan: 'pro' })
-- .eq('id', myOrgId). RLS governs row visibility, not column
-- writability, so billing state needs an explicit column-privilege
-- lockdown. Only the service role (used by the Stripe webhook handler)
-- may write plan/stripe_customer_id/stripe_subscription_id/
-- subscription_status/trial_ends_at/current_period_end/plan_updated_at;
-- authenticated users keep the ability to rename their own org.
revoke update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;
