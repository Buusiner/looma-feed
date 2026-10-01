create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null check (char_length(trim(title)) > 0),
  body text not null default '',
  source_type text,
  source_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;

alter table public.notification_events drop constraint if exists notification_events_type_check;
alter table public.notification_events add constraint notification_events_type_check check (
  type in (
    'like',
    'comment',
    'repost',
    'retweet',
    'connection_request',
    'connection_accepted',
    'proposal',
    'proposal_received',
    'proposal_updated',
    'system'
  )
);

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
grant all on table public.notification_events to service_role;

create or replace function public.create_relationship_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'connections' then
    if tg_op = 'INSERT' and new.status = 'pending' then
      insert into public.notification_events(
        user_id,
        actor_id,
        type,
        title,
        body,
        source_type,
        source_id
      )
      values (
        new.addressee_id,
        new.requester_id,
        'connection_request',
        'Nova solicitação de conexão',
        'Alguém quer se conectar com você.',
        'connection',
        new.id
      );
    elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
      insert into public.notification_events(
        user_id,
        actor_id,
        type,
        title,
        body,
        source_type,
        source_id
      )
      values (
        new.requester_id,
        new.addressee_id,
        'connection_accepted',
        'Solicitação de conexão aceita',
        'Sua solicitação de conexão foi aceita.',
        'connection',
        new.id
      );
    end if;
  elsif tg_table_name = 'proposals' then
    if tg_op = 'INSERT' then
      insert into public.notification_events(
        user_id,
        actor_id,
        type,
        title,
        body,
        source_type,
        source_id
      )
      values (
        new.recipient_id,
        new.sender_id,
        'proposal_received',
        'Nova proposta recebida',
        coalesce(nullif(trim(new.title), ''), 'Você recebeu uma proposta.'),
        'proposal',
        new.id
      );
    elsif tg_op = 'UPDATE' and new.status <> old.status then
      insert into public.notification_events(
        user_id,
        actor_id,
        type,
        title,
        body,
        source_type,
        source_id
      )
      values (
        new.sender_id,
        new.recipient_id,
        'proposal_updated',
        'Sua proposta foi atualizada',
        'Status: ' || new.status,
        'proposal',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.create_relationship_notification() from public;

drop trigger if exists connection_notification on public.connections;
create trigger connection_notification
after insert or update of status on public.connections
for each row execute function public.create_relationship_notification();

drop trigger if exists proposal_notification on public.proposals;
create trigger proposal_notification
after insert or update of status on public.proposals
for each row execute function public.create_relationship_notification();

notify pgrst, 'reload schema';
