-- Run once in the Supabase SQL Editor.
-- It keeps profile edits and avatar uploads limited to the signed-in user.

create unique index if not exists profiles_username_unique_lower
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles enable row level security;

drop policy if exists "Looma reads profiles" on public.profiles;
create policy "Looma reads profiles"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Looma updates own profile" on public.profiles;
create policy "Looma updates own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Looma users upload their avatar" on storage.objects;
create policy "Looma users upload their avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
