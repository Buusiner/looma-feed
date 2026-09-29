-- A recipient decides whether to accept or decline. Only the sender may cancel
-- a pending request; either participant may later remove an accepted connection.
drop policy if exists "Participants delete connections" on public.connections;
drop policy if exists "Requesters cancel pending connections" on public.connections;
drop policy if exists "Participants remove accepted connections" on public.connections;

create policy "Requesters cancel pending connections"
  on public.connections
  for delete
  using (auth.uid() = requester_id and status = 'pending');

create policy "Participants remove accepted connections"
  on public.connections
  for delete
  using (
    status = 'accepted'
    and (auth.uid() = requester_id or auth.uid() = addressee_id)
  );
