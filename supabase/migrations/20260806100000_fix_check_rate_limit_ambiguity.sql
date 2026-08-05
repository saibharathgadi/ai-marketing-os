-- The previous check_rate_limit function had a bare `reset_at` reference
-- in its DELETE statement's WHERE clause, which Postgres flagged as
-- ambiguous at call time: the function's own OUT parameter is also
-- named `reset_at`, and PL/pgSQL couldn't tell whether the bare
-- identifier meant the table column or the output variable ("column
-- reference \"reset_at\" is ambiguous... could refer to either a
-- PL/pgSQL variable or a table column"). try_start_audit/finish_audit
-- don't have this issue since their OUT parameter names (claimed,
-- reason) don't collide with any column name.
--
-- Fix: qualify the column reference with its table name, which
-- unambiguously means "the column", never the variable.

create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_ms int)
returns table(allowed boolean, remaining int, reset_at timestamptz, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limit_counters%rowtype;
begin
  delete from public.rate_limit_counters
  where public.rate_limit_counters.reset_at < v_now - interval '1 hour';

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
