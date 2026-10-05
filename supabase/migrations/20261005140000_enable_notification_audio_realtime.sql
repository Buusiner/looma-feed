-- Deliver new notifications to the centralized UI audio bridge. Existing RLS
-- still restricts subscribers to their own events; historical rows stay silent.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'notification_events'
    ) then
    alter publication supabase_realtime add table public.notification_events;
  end if;
end $$;
