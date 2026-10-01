create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (
    type in (
      'like',
      'comment',
      'repost',
      'retweet',
      'connection_request',
      'proposal',
      'system'
    )
  ),
  title text not null check (char_length(trim(title)) > 0),
  body text not null default '',
  source_type text,
  source_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;

drop policy if exists "Users read own notification events" on public.notification_events;
create policy "Users read own notification events"
  on public.notification_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own notification events" on public.notification_events;
create policy "Users update own notification events"
  on public.notification_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users create own notification events" on public.notification_events;
create policy "Users create own notification events"
  on public.notification_events
  for insert
  with check (auth.uid() = user_id);

create index if not exists notification_events_user_created_idx
  on public.notification_events(user_id, created_at desc);

create index if not exists notification_events_user_unread_idx
  on public.notification_events(user_id, is_read)
  where is_read = false;

grant select, insert, update on table public.notification_events to authenticated;
