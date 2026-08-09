-- Looma workspace: execute this file in the Supabase SQL Editor before using
-- the seven workspace pages. It contains only the tables and policies consumed
-- by the client routes below.

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  type text,
  category text,
  work_mode text check (work_mode in ('remote', 'hybrid', 'onsite')),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.opportunity_saves (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, user_id)
);

create table if not exists public.opportunity_views (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (opportunity_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  status text not null default 'published' check (status in ('published', 'draft')),
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subject text not null check (char_length(trim(subject)) > 0),
  message text not null check (char_length(trim(message)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_connection_notifications boolean not null default true,
  email_proposal_notifications boolean not null default true,
  is_profile_public boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;
alter table public.opportunity_saves enable row level security;
alter table public.opportunity_views enable row level security;
alter table public.posts enable row level security;
alter table public.connections enable row level security;
alter table public.proposals enable row level security;
alter table public.support_tickets enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "Opportunities are readable" on public.opportunities;
create policy "Opportunities are readable" on public.opportunities for select using (true);
drop policy if exists "Authors manage opportunities" on public.opportunities;
create policy "Authors manage opportunities" on public.opportunities for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Users manage their opportunity saves" on public.opportunity_saves;
create policy "Users manage their opportunity saves" on public.opportunity_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their opportunity views" on public.opportunity_views;
create policy "Users manage their opportunity views" on public.opportunity_views for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Published posts are readable" on public.posts;
create policy "Published posts are readable" on public.posts for select using (status = 'published' or auth.uid() = author_id);
drop policy if exists "Authors manage posts" on public.posts;
create policy "Authors manage posts" on public.posts for all using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Users see their connections" on public.connections;
create policy "Users see their connections" on public.connections for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists "Requesters create connections" on public.connections;
create policy "Requesters create connections" on public.connections for insert with check (auth.uid() = requester_id);
drop policy if exists "Participants update connections" on public.connections;
create policy "Participants update connections" on public.connections for update using (auth.uid() = requester_id or auth.uid() = addressee_id) with check (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists "Participants delete connections" on public.connections;
create policy "Participants delete connections" on public.connections for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users see their proposals" on public.proposals;
create policy "Users see their proposals" on public.proposals for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "Senders create proposals" on public.proposals;
create policy "Senders create proposals" on public.proposals for insert with check (auth.uid() = sender_id);
drop policy if exists "Participants update proposals" on public.proposals;
create policy "Participants update proposals" on public.proposals for update using (auth.uid() = sender_id or auth.uid() = recipient_id) with check (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users create and read own tickets" on public.support_tickets;
drop policy if exists "Users create own tickets" on public.support_tickets;
create policy "Users create and read own tickets" on public.support_tickets for select using (auth.uid() = user_id);
create policy "Users create own tickets" on public.support_tickets for insert with check (auth.uid() = user_id);

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists opportunities_created_at_idx on public.opportunities(created_at desc);
create index if not exists posts_author_status_created_idx on public.posts(author_id, status, created_at desc);
create index if not exists connections_participants_idx on public.connections(requester_id, addressee_id, status);
create index if not exists proposals_participants_idx on public.proposals(sender_id, recipient_id, status);
