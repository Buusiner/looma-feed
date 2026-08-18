-- Interest capture only. No billing provider, payment method or checkout is
-- introduced by this migration.

create table if not exists public.plan_interest (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, plan)
);

create index if not exists plan_interest_profile_id_idx
  on public.plan_interest (profile_id);

alter table public.plan_interest enable row level security;

drop policy if exists "Users read own plan interest" on public.plan_interest;
create policy "Users read own plan interest"
  on public.plan_interest for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Users register own plan interest" on public.plan_interest;
create policy "Users register own plan interest"
  on public.plan_interest for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

drop policy if exists "Users update own plan interest" on public.plan_interest;
create policy "Users update own plan interest"
  on public.plan_interest for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

grant select, insert, update on public.plan_interest to authenticated;

-- Verification:
-- select to_regclass('public.plan_interest');
