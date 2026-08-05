-- Replaces the in-memory (globalThis) rate limiter and audit queue with
-- Postgres-backed durable equivalents, so both actually coordinate
-- across concurrent Vercel serverless instances instead of only within
-- a single warm process. See TECH_DEBT.md for the original gap this
-- closes.

-- ============================================================
-- Rate limiter
-- ============================================================

create table public.rate_limit_counters (
  key text primary key,
  count int not null,
  reset_at timestamptz not null
);

create index on public.rate_limit_counters (reset_at);

alter table public.rate_limit_counters enable row level security;
-- No policies -- this is an operational table with zero client-role
-- access. Only the service-role client (which bypasses RLS) touches it.

-- Single atomic upsert: INSERT ... ON CONFLICT DO UPDATE takes an
-- implicit row-level lock for the statement's duration, so concurrent
-- callers on the same key are serialized for free -- no explicit
-- SELECT ... FOR UPDATE or advisory lock needed here.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_ms int
)
returns table(
  allowed boolean,
  remaining int,
  reset_at timestamptz,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limit_counters%rowtype;
begin
  delete from public.rate_limit_counters
  where reset_at < v_now - interval '1 hour';

  insert into public.rate_limit_counters (key, count, reset_at)
  values (p_key, 1, v_now + (p_window_ms || ' milliseconds')::interval)
  on conflict (key) do update
    set count = case when rate_limit_counters.reset_at <= v_now then 1
                      else rate_limit_counters.count + 1 end,
        reset_at = case when rate_limit_counters.reset_at <= v_now
                      then v_now + (p_window_ms || ' milliseconds')::interval
                      else rate_limit_counters.reset_at end
  returning * into v_row;

  allowed := v_row.count <= p_limit;
  remaining := greatest(p_limit - v_row.count, 0);
  reset_at := v_row.reset_at;
  retry_after_seconds := case when allowed then 0
    else greatest(ceil(extract(epoch from (v_row.reset_at - v_now)))::int, 0) end;
  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ============================================================
-- Audit queue
-- ============================================================

-- A row's mere existence IS "currently running" -- there's no separate
-- "queued" state. The old in-memory design's maxActive cap was already
-- only a per-process throttle (nothing stopped N concurrent instances
-- from each running their own maxActive), so "atomically claim one of
-- maxActive *global* slots, reject immediately if none free" is a
-- strictly tighter guarantee than before, even with no queueing/wait.
create table public.audit_queue_jobs (
  id uuid primary key default gen_random_uuid(),
  lock_key text not null unique,
  started_at timestamptz not null default now()
);

alter table public.audit_queue_jobs enable row level security;

-- Durable replacement for the old in-memory failedCount/failedByReason
-- counters (previously reset on every cold start).
create table public.audit_queue_failure_counts (
  failure_reason text primary key,
  count bigint not null default 0
);

alter table public.audit_queue_failure_counts enable row level security;

-- pg_advisory_xact_lock (not SELECT ... FOR UPDATE SKIP LOCKED --
-- there's no backlog of rows to skip over here, just one tiny critical
-- section to serialize) is transaction-scoped and self-releasing when
-- this RPC's transaction ends. PostgREST wraps each RPC call in its own
-- transaction, so the lock is held only for this function call, never
-- across the actual crawl (which runs in JS, after this has returned).
--
-- Also reaps stale rows on every call: a serverless instance dying
-- mid-crawl (timeout/OOM/eviction) can no longer rely on globalThis
-- vanishing to clean up after it -- a Postgres row doesn't disappear on
-- its own, so without this, one crashed crawl would permanently lock
-- its URL and permanently occupy a concurrency slot.
create or replace function public.try_start_audit(
  p_lock_key text,
  p_max_active int,
  p_stale_after_ms int
)
returns table(claimed boolean, reason text) -- reason: 'ok' | 'locked' | 'queue_full'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_running_count int;
begin
  perform pg_advisory_xact_lock(872341987);

  delete from public.audit_queue_jobs
  where started_at < v_now - (p_stale_after_ms || ' milliseconds')::interval;

  begin
    insert into public.audit_queue_jobs (lock_key, started_at)
    values (p_lock_key, v_now);
  exception when unique_violation then
    claimed := false;
    reason := 'locked';
    return next;
    return;
  end;

  select count(*) into v_running_count from public.audit_queue_jobs;

  if v_running_count > p_max_active then
    delete from public.audit_queue_jobs where lock_key = p_lock_key;
    claimed := false;
    reason := 'queue_full';
    return next;
    return;
  end if;

  claimed := true;
  reason := 'ok';
  return next;
end;
$$;

create or replace function public.finish_audit(
  p_lock_key text,
  p_failure_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.audit_queue_jobs where lock_key = p_lock_key;

  if p_failure_reason is not null then
    insert into public.audit_queue_failure_counts (failure_reason, count)
    values (p_failure_reason, 1)
    on conflict (failure_reason) do update
      set count = audit_queue_failure_counts.count + 1;
  end if;
end;
$$;

revoke all on function public.try_start_audit(text, int, int) from public, anon, authenticated;
revoke all on function public.finish_audit(text, text) from public, anon, authenticated;
grant execute on function public.try_start_audit(text, int, int) to service_role;
grant execute on function public.finish_audit(text, text) to service_role;
