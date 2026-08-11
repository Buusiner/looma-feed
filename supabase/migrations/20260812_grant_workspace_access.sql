grant usage on schema public to anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant update on table public.profiles to authenticated;

grant select on table public.posts to anon, authenticated;
grant insert, update, delete on table public.posts to authenticated;

grant select on table public.opportunities to anon, authenticated;
grant insert, update, delete on table public.opportunities to authenticated;

grant select, insert, update, delete on table public.opportunity_saves to authenticated;
grant select, insert, update, delete on table public.opportunity_views to authenticated;
grant select, insert, update, delete on table public.connections to authenticated;
grant select, insert, update, delete on table public.proposals to authenticated;
grant select, insert, update, delete on table public.support_tickets to authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;
