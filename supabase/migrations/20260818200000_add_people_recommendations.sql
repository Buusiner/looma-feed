-- Data model and query for real "Pessoas em movimento" recommendations.
-- Opportunity tags are intentionally explicit: a recommendation is never
-- inferred from mock data or a random profile list.

create table if not exists public.opportunity_skill_tags (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  skill_tag_id uuid not null references public.skill_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, skill_tag_id)
);

create table if not exists public.skill_complement_pairs (
  skill_tag_a_id uuid not null references public.skill_tags(id) on delete cascade,
  skill_tag_b_id uuid not null references public.skill_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (skill_tag_a_id, skill_tag_b_id),
  constraint skill_complement_pairs_distinct check (skill_tag_a_id <> skill_tag_b_id),
  constraint skill_complement_pairs_ordered check (skill_tag_a_id < skill_tag_b_id)
);

create index if not exists opportunity_skill_tags_skill_opportunity_idx
  on public.opportunity_skill_tags (skill_tag_id, opportunity_id);
create index if not exists opportunities_author_created_idx
  on public.opportunities (author_id, created_at desc)
  where author_id is not null;
create index if not exists user_skills_skill_profile_idx
  on public.user_skills (skill_tag_id, profile_id)
  where skill_tag_id is not null;

alter table public.opportunity_skill_tags enable row level security;
alter table public.skill_complement_pairs enable row level security;

drop policy if exists "Opportunity skill tags are readable" on public.opportunity_skill_tags;
create policy "Opportunity skill tags are readable"
  on public.opportunity_skill_tags for select using (true);
drop policy if exists "Opportunity authors manage skill tags" on public.opportunity_skill_tags;
create policy "Opportunity authors manage skill tags"
  on public.opportunity_skill_tags for all
  using (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.author_id = (select auth.uid())
    )
  );

drop policy if exists "Complementary skills are readable" on public.skill_complement_pairs;
create policy "Complementary skills are readable"
  on public.skill_complement_pairs for select using (true);

grant select on public.opportunity_skill_tags, public.skill_complement_pairs to anon, authenticated;
grant insert, update, delete on public.opportunity_skill_tags to authenticated;

-- The order is canonical so each complementary relation is stored once.
with requested_pairs(left_name, right_name) as (
  values
    ('Designer gráfico', 'Copywriter'),
    ('Designer UI/UX', 'Desenvolvedor front-end'),
    ('Desenvolvedor front-end', 'Desenvolvedor back-end'),
    ('Desenvolvedor mobile', 'Designer UI/UX'),
    ('Product manager', 'UX researcher'),
    ('Analista de dados', 'Especialista em marketing digital'),
    ('Especialista em SEO', 'Redator'),
    ('Gestor de tráfego pago', 'Designer gráfico'),
    ('Social media', 'Editor de vídeo'),
    ('Produtor de podcast', 'Sound designer'),
    ('Fotógrafo', 'Editor de fotos'),
    ('Desenvolvedor de jogos', 'Game designer'),
    ('Especialista em e-commerce', 'Copywriter'),
    ('Consultor de branding', 'Designer de identidade visual'),
    ('Especialista em IA generativa', 'Desenvolvedor Python'),
    ('Especialista em automação no-code', 'Analista de operações'),
    ('Gerente de projetos digitais', 'Scrum master'),
    ('Community manager', 'Estrategista de conteúdo'),
    ('Especialista em Google Ads', 'Especialista em CRO'),
    ('Editor de podcast', 'Roteirista para podcast')
)
insert into public.skill_complement_pairs (skill_tag_a_id, skill_tag_b_id)
select least(left_tag.id, right_tag.id), greatest(left_tag.id, right_tag.id)
from requested_pairs
join public.skill_tags left_tag on left_tag.name = requested_pairs.left_name
join public.skill_tags right_tag on right_tag.name = requested_pairs.right_name
on conflict do nothing;

create or replace function public.get_people_in_motion(result_limit integer default 3)
returns table (
  profile_id uuid,
  full_name text,
  username text,
  avatar_url text,
  recommendation_reason text,
  recommendation_score integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with app_user as (
    select (select auth.uid()) as id
  ),
  my_skills as (
    select us.skill_tag_id
    from public.user_skills us
    join app_user cu on cu.id = us.profile_id
    where us.skill_tag_id is not null
  ),
  unavailable_profiles as (
    select case
      when c.requester_id = cu.id then c.addressee_id
      else c.requester_id
    end as profile_id
    from public.connections c
    join app_user cu on c.requester_id = cu.id or c.addressee_id = cu.id
    where c.status in ('pending', 'accepted')
  ),
  opportunity_matches as (
    select o.author_id as profile_id, count(distinct ost.skill_tag_id)::integer * 5 as score
    from public.opportunity_skill_tags ost
    join public.opportunities o on o.id = ost.opportunity_id
    join my_skills ms on ms.skill_tag_id = ost.skill_tag_id
    join app_user cu on true
    where o.author_id is not null
      and o.author_id <> cu.id
      and o.created_at >= now() - interval '180 days'
    group by o.author_id
  ),
  complementary_matches as (
    select candidate_skills.profile_id, count(distinct candidate_skills.skill_tag_id)::integer * 2 as score
    from my_skills mine
    join public.skill_complement_pairs pair
      on pair.skill_tag_a_id = mine.skill_tag_id or pair.skill_tag_b_id = mine.skill_tag_id
    join public.user_skills candidate_skills
      on candidate_skills.skill_tag_id = case
        when pair.skill_tag_a_id = mine.skill_tag_id then pair.skill_tag_b_id
        else pair.skill_tag_a_id
      end
    join app_user cu on true
    where candidate_skills.profile_id <> cu.id
    group by candidate_skills.profile_id
  ),
  candidates as (
    select
      coalesce(om.profile_id, cm.profile_id) as profile_id,
      coalesce(om.score, 0) as opportunity_score,
      coalesce(cm.score, 0) as complementary_score
    from opportunity_matches om
    full outer join complementary_matches cm on cm.profile_id = om.profile_id
  )
  select
    p.id as profile_id,
    p.full_name,
    p.username,
    p.avatar_url,
    case
      when c.opportunity_score > 0 and c.complementary_score > 0 then 'Tem oportunidades e habilidades que combinam com você'
      when c.opportunity_score > 0 then 'Publicou oportunidades para as suas habilidades'
      else 'Tem habilidades complementares às suas'
    end as recommendation_reason,
    (c.opportunity_score + c.complementary_score)::integer as recommendation_score
  from candidates c
  join public.profiles p on p.id = c.profile_id
  left join unavailable_profiles up on up.profile_id = c.profile_id
  where up.profile_id is null
  order by (c.opportunity_score + c.complementary_score) desc, p.created_at desc
  limit greatest(1, least(coalesce(result_limit, 3), 10));
$$;

revoke execute on function public.get_people_in_motion(integer) from public, anon;
grant execute on function public.get_people_in_motion(integer) to authenticated;

-- Verification as an authenticated user:
-- select * from public.get_people_in_motion(3);
