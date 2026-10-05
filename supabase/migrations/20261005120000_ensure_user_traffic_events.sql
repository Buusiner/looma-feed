-- Repair environments where the original traffic migration was not applied.
-- Safe to run from the Supabase SQL Editor even when the table already exists.
begin;

create table if not exists public.user_traffic_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null check (char_length(trim(path)) > 0),
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.user_traffic_events enable row level security;

drop policy if exists "Users insert own traffic events" on public.user_traffic_events;
create policy "Users insert own traffic events"
  on public.user_traffic_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own traffic events" on public.user_traffic_events;
create policy "Users read own traffic events"
  on public.user_traffic_events
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists user_traffic_events_user_created_idx
  on public.user_traffic_events(user_id, created_at desc);

grant select, insert on table public.user_traffic_events to authenticated;
grant all on table public.user_traffic_events to service_role;

notify pgrst, 'reload schema';

commit;
