-- Administrative access is stored separately from public profile data so the
-- interface is not the authority that decides who can read support tickets.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Administrators can read own access" on public.admin_users;
create policy "Administrators can read own access"
  on public.admin_users
  for select
  using (auth.uid() = user_id);

create or replace function public.is_looma_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_looma_admin() from public;
grant execute on function public.is_looma_admin() to authenticated;

insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = 'suporteloomaapp@gmail.com'
on conflict (user_id) do nothing;

drop policy if exists "Users create and read own tickets" on public.support_tickets;
drop policy if exists "Users and administrators read support tickets" on public.support_tickets;
create policy "Users and administrators read support tickets"
  on public.support_tickets
  for select
  using (auth.uid() = user_id or public.is_looma_admin());
