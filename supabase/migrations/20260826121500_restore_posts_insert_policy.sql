-- Mantém a policy original de criação enquanto as permissões de edição e
-- exclusão permanecem explícitas e restritas ao autor.
drop policy if exists "Authors create posts" on public.posts;

create policy "Authors manage posts"
  on public.posts
  for all
  to public
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
