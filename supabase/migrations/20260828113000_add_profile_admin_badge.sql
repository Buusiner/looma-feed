-- Keep the public verification badge in sync with the administrative allowlist.
-- The allowlist itself remains protected by RLS; only the boolean badge is public.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles as profile
set is_admin = exists (
  select 1
  from public.admin_users as admin_user
  where admin_user.user_id = profile.id
);

create or replace function public.sync_profile_admin_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles
    set is_admin = false
    where id = old.user_id;
    return old;
  end if;

  update public.profiles
  set is_admin = true
  where id = new.user_id;
  return new;
end;
$$;

revoke all on function public.sync_profile_admin_badge() from public;

drop trigger if exists sync_profile_admin_badge_after_change on public.admin_users;
create trigger sync_profile_admin_badge_after_change
after insert or delete on public.admin_users
for each row execute function public.sync_profile_admin_badge();
