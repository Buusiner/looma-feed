-- A post can be an ordinary publication or an open piece of work that receives proposals.
alter table public.posts
  add column if not exists kind text not null default 'post';

alter table public.posts
  drop constraint if exists posts_kind_check;

alter table public.posts
  add constraint posts_kind_check check (kind in ('post', 'work'));

alter table public.proposals
  add column if not exists post_id uuid references public.posts(id) on delete set null;

alter table public.proposals
  drop constraint if exists proposals_message_length_check;

alter table public.proposals
  add constraint proposals_message_length_check check (char_length(message) <= 1000);

create unique index if not exists proposals_post_sender_unique
  on public.proposals (post_id, sender_id)
  where post_id is not null;

create index if not exists proposals_post_id_idx
  on public.proposals (post_id);

-- Only the recipient may accept or decline a pending proposal.
drop policy if exists "Participants update proposals" on public.proposals;
drop policy if exists "Recipients respond to proposals" on public.proposals;

create policy "Recipients respond to proposals"
  on public.proposals for update
  using (
    auth.uid() = recipient_id
    and status = 'pending'
  )
  with check (
    auth.uid() = recipient_id
    and status in ('accepted', 'declined')
  );

drop policy if exists "Senders cancel pending proposals" on public.proposals;

create policy "Senders cancel pending proposals"
  on public.proposals for delete
  using (
    auth.uid() = sender_id
    and status = 'pending'
  );
