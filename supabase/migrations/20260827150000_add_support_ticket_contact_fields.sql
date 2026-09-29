-- Preserve the contact details supplied with a support request so the Looma team
-- can respond even when the reporter later changes their profile.
alter table public.support_tickets
  add column if not exists email text,
  add column if not exists username text;

create index if not exists support_tickets_created_at_idx
  on public.support_tickets (created_at desc);
