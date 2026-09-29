-- Aggregate only operational counts for the administrative dashboard.
-- Detailed records continue to use their own RLS policies.
create or replace function public.get_admin_dashboard_metrics()
returns table (
  profiles_count bigint,
  posts_count bigint,
  connections_count bigint,
  proposals_count bigint,
  support_tickets_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_looma_admin() then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.posts where status = 'published'),
    (select count(*) from public.connections where status = 'accepted'),
    (select count(*) from public.proposals),
    (select count(*) from public.support_tickets);
end;
$$;

revoke all on function public.get_admin_dashboard_metrics() from public;
grant execute on function public.get_admin_dashboard_metrics() to authenticated;
