-- Preserve the existing public read behavior while keeping each write action scoped to its author.
drop policy if exists "Authors manage posts" on public.posts;
drop policy if exists "Authors create posts" on public.posts;
drop policy if exists "Authors update own posts" on public.posts;
drop policy if exists "Authors delete own posts" on public.posts;

create policy "Authors create posts"
  on public.posts for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Authors update own posts"
  on public.posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Authors delete own posts"
  on public.posts for delete
  to authenticated
  using ((select auth.uid()) = author_id);
