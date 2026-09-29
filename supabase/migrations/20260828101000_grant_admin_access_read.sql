-- RLS decides which authenticated account can see its own administrative row.
-- This grant only enables the API role to reach that policy.
grant select on table public.admin_users to authenticated;
