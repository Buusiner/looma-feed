-- Creates the publication table required by Home, Publications and Reports.
-- This is safe to run even if a previous environment already has the table.

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

alter table public.posts enable row level security;

drop policy if exists "Published posts are readable" on public.posts;
create policy "Published posts are readable"
  on public.posts for select
  using (status = 'published' or auth.uid() = author_id);

drop policy if exists "Authors manage posts" on public.posts;
create policy "Authors manage posts"
  on public.posts for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create index if not exists posts_author_status_created_idx
  on public.posts(author_id, status, created_at desc);
