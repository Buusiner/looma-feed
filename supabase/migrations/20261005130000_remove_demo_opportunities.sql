-- Delete only the two confirmed demo opportunities from the original setup.
-- Exact IDs and content prevent this cleanup from deleting user opportunities.
begin;

delete from public.opportunities
where author_id is null
  and created_at = '2026-08-18T09:46:42.677759+00:00'::timestamptz
  and (
    (
      id = '7063f48b-847e-411a-9fed-48f68acc85e8'::uuid
      and title = 'Projeto de interface'
      and description = 'Precisamos de designer UI/UX'
    )
    or (
      id = '38b2cb66-5e48-4c27-8a2b-2af8e3a831f7'::uuid
      and title = 'Landing de campanha'
      and description = 'Precisamos de designer gráfico'
    )
  );

commit;
