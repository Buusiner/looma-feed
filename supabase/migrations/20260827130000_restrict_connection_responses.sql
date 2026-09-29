-- The recipient alone may decide the outcome of a pending connection request.
drop policy if exists "Participants update connections" on public.connections;
drop policy if exists "Addressees respond to connection requests" on public.connections;

create policy "Addressees respond to connection requests"
  on public.connections for update
  using (
    auth.uid() = addressee_id
    and status = 'pending'
  )
  with check (
    auth.uid() = addressee_id
    and status in ('accepted', 'declined')
  );
