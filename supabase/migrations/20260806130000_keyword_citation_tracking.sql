-- Phase 2: AI citation tracking. Traditional numeric SERP rank tracking
-- needs a paid third-party API and conflicts with this project's
-- free-tier-first constraint. Instead we ask Gemini (already free,
-- Google Search grounding, see aiProvider.ts) a grounded question per
-- tracked keyword and record which domains its grounding metadata
-- actually cited. Competitor tracking falls out for free: whichever
-- other domains get cited for the same query ARE the competitors --
-- no separate "add a competitor" lookup is needed.

create table if not exists public.tracked_keywords (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Soft link for UI convenience only (auto-fill the domain when
  -- adding a keyword) -- not the source of truth for checks, see
  -- target_domain below.
  monitored_website_id uuid references public.monitored_websites (id) on delete set null,
  keyword text not null,
  -- Denormalized rather than derived via monitored_website_id join on
  -- every check: a keyword's tracking target should never silently
  -- change if the parent monitored-website row is edited or removed
  -- later, and this avoids a join on the cron sweep's hot path.
  target_domain text not null,
  status text not null default 'active' check (
    status in ('active', 'paused', 'archived')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable append-only log row per periodic check -- same shape as
-- audits (no lifecycle status column; a completed check never
-- changes state).
create table if not exists public.keyword_checks (
  id uuid primary key default gen_random_uuid(),
  tracked_keyword_id uuid not null references public.tracked_keywords (id) on delete cascade,
  -- Denormalized to match the parent keyword's org_id, so RLS stays a
  -- flat org_id check with no join -- same tradeoff ad_sets already
  -- made against campaigns.
  org_id uuid not null references public.organizations (id) on delete cascade,
  was_cited boolean not null,
  cited_domains text[] not null default '{}',
  -- Precomputed at write time (cited_domains minus target_domain) so
  -- the UI never has to derive "who else got cited" on every read.
  competitor_domains text[] not null default '{}',
  raw_answer text,
  raw_chunks jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tracked_keywords_org_id_created_at_idx
on public.tracked_keywords (org_id, created_at desc);

create index if not exists tracked_keywords_org_id_status_idx
on public.tracked_keywords (org_id, status);

create unique index if not exists tracked_keywords_org_keyword_domain_unique_idx
on public.tracked_keywords (org_id, lower(keyword), target_domain);

create index if not exists keyword_checks_org_id_created_at_idx
on public.keyword_checks (org_id, created_at desc);

-- Primary list-filter for this feature: one tracked_keyword_id's own
-- chronological check history.
create index if not exists keyword_checks_tracked_keyword_id_created_at_idx
on public.keyword_checks (tracked_keyword_id, created_at desc);

alter table public.tracked_keywords enable row level security;
alter table public.keyword_checks enable row level security;

drop policy if exists "org members can select tracked_keywords" on public.tracked_keywords;
create policy "org members can select tracked_keywords"
on public.tracked_keywords for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert tracked_keywords" on public.tracked_keywords;
create policy "org members can insert tracked_keywords"
on public.tracked_keywords for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update tracked_keywords" on public.tracked_keywords;
create policy "org members can update tracked_keywords"
on public.tracked_keywords for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete tracked_keywords" on public.tracked_keywords;
create policy "org members can delete tracked_keywords"
on public.tracked_keywords for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can select keyword_checks" on public.keyword_checks;
create policy "org members can select keyword_checks"
on public.keyword_checks for select
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can insert keyword_checks" on public.keyword_checks;
create policy "org members can insert keyword_checks"
on public.keyword_checks for insert
to authenticated
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can update keyword_checks" on public.keyword_checks;
create policy "org members can update keyword_checks"
on public.keyword_checks for update
to authenticated
using (
  org_id in (select public.get_my_org_ids())
)
with check (
  org_id in (select public.get_my_org_ids())
);

drop policy if exists "org members can delete keyword_checks" on public.keyword_checks;
create policy "org members can delete keyword_checks"
on public.keyword_checks for delete
to authenticated
using (
  org_id in (select public.get_my_org_ids())
);
