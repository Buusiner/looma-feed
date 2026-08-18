-- Looma onboarding data model.
-- Safe to apply once to the linked Supabase project with `supabase db push`.

create extension if not exists pg_trgm with schema extensions;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists experience_level text
    check (experience_level in ('iniciante', 'intermediario', 'experiente'));

create table if not exists public.skill_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

insert into public.skill_tags (name)
values
  ('Editor de vídeo'),
  ('Motion designer'),
  ('Designer gráfico'),
  ('Designer UI/UX'),
  ('Ilustrador'),
  ('Modelador 3D'),
  ('Animador 2D/3D'),
  ('Fotógrafo'),
  ('Redator'),
  ('Roteirista'),
  ('Social media'),
  ('Gestor de tráfego pago'),
  ('Desenvolvedor front-end'),
  ('Desenvolvedor back-end'),
  ('Desenvolvedor mobile'),
  ('Desenvolvedor full-stack'),
  ('Analista de dados'),
  ('Cientista de dados'),
  ('Especialista em SEO'),
  ('Produtor de podcast'),
  ('Sound designer'),
  ('Locutor'),
  ('Tradutor'),
  ('Legendador'),
  ('Consultor de marketing digital'),
  ('Gerente de projetos digitais'),
  ('Especialista em e-mail marketing'),
  ('Copywriter'),
  ('Game designer'),
  ('Desenvolvedor de jogos'),
  ('Product manager'),
  ('UX researcher'),
  ('Arquiteto de software'),
  ('DevOps'),
  ('Especialista em automação no-code'),
  ('Assistente virtual'),
  ('Community manager'),
  ('Consultor de branding'),
  ('Web designer'),
  ('Especialista em CRO'),
  ('Editor de fotos'),
  ('Dublador'),
  ('Compositor musical'),
  ('Produtor musical'),
  ('Engenheiro de áudio'),
  ('Diretor de arte'),
  ('Designer de produto'),
  ('Estrategista de conteúdo'),
  ('Especialista em e-commerce'),
  ('Analista de produto')
on conflict (name) do nothing;

create index if not exists skill_tags_name_trgm_idx
  on public.skill_tags using gin (name extensions.gin_trgm_ops);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_tag_id uuid references public.skill_tags(id) on delete restrict,
  custom_label text,
  created_at timestamptz not null default now(),
  constraint user_skills_source_check check (
    (skill_tag_id is not null and custom_label is null)
    or (skill_tag_id is null and char_length(trim(custom_label)) > 0)
  )
);

create unique index if not exists user_skills_profile_skill_tag_unique
  on public.user_skills (profile_id, skill_tag_id)
  where skill_tag_id is not null;

create unique index if not exists user_skills_profile_custom_label_unique
  on public.user_skills (profile_id, lower(custom_label))
  where custom_label is not null;

create or replace function public.enforce_user_skills_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Lock the profile row so simultaneous inserts cannot exceed the limit.
  perform 1 from public.profiles where id = new.profile_id for update;

  if (
    select count(*)
    from public.user_skills
    where profile_id = new.profile_id
      and id is distinct from new.id
  ) >= 3 then
    raise exception 'Cada perfil pode ter no máximo 3 habilidades.';
  end if;

  return new;
end;
$$;

drop trigger if exists user_skills_limit_per_profile on public.user_skills;
create trigger user_skills_limit_per_profile
  before insert or update of profile_id on public.user_skills
  for each row execute function public.enforce_user_skills_limit();

create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('instagram', 'youtube', 'tiktok', 'outro')),
  label text,
  url text not null check (url ~* '^https?://'),
  created_at timestamptz not null default now()
);

create unique index if not exists profile_links_profile_type_unique
  on public.profile_links (profile_id, type)
  where type <> 'outro';

create index if not exists user_skills_profile_id_idx
  on public.user_skills (profile_id);

create index if not exists profile_links_profile_id_idx
  on public.profile_links (profile_id);

alter table public.skill_tags enable row level security;
alter table public.user_skills enable row level security;
alter table public.profile_links enable row level security;

drop policy if exists "Skill tags are publicly readable" on public.skill_tags;
create policy "Skill tags are publicly readable"
  on public.skill_tags for select using (true);

drop policy if exists "User skills are publicly readable" on public.user_skills;
create policy "User skills are publicly readable"
  on public.user_skills for select using (true);
drop policy if exists "Users insert own skills" on public.user_skills;
create policy "Users insert own skills"
  on public.user_skills for insert with check (auth.uid() = profile_id);
drop policy if exists "Users update own skills" on public.user_skills;
create policy "Users update own skills"
  on public.user_skills for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "Users delete own skills" on public.user_skills;
create policy "Users delete own skills"
  on public.user_skills for delete using (auth.uid() = profile_id);

drop policy if exists "Profile links are publicly readable" on public.profile_links;
create policy "Profile links are publicly readable"
  on public.profile_links for select using (true);
drop policy if exists "Users insert own profile links" on public.profile_links;
create policy "Users insert own profile links"
  on public.profile_links for insert with check (auth.uid() = profile_id);
drop policy if exists "Users update own profile links" on public.profile_links;
create policy "Users update own profile links"
  on public.profile_links for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "Users delete own profile links" on public.profile_links;
create policy "Users delete own profile links"
  on public.profile_links for delete using (auth.uid() = profile_id);

grant select on public.skill_tags, public.user_skills, public.profile_links to anon, authenticated;
grant insert, update, delete on public.user_skills, public.profile_links to authenticated;

-- Used by the onboarding's "Outro" choice. The UI must ask for confirmation
-- before it replaces a custom label with a suggested catalog tag.
create or replace function public.find_similar_skill_tags(search_term text, result_limit integer default 3)
returns table (id uuid, name text, similarity real)
language sql
stable
set search_path = public, extensions
as $$
  select skill_tags.id, skill_tags.name, extensions.similarity(skill_tags.name, search_term)::real
  from public.skill_tags
  where extensions.similarity(skill_tags.name, search_term) >= 0.35
  order by extensions.similarity(skill_tags.name, search_term) desc, skill_tags.name
  limit greatest(1, least(coalesce(result_limit, 3), 10));
$$;

grant execute on function public.find_similar_skill_tags(text, integer) to anon, authenticated;

-- Verification after applying this migration:
-- select count(*) as seeded_skill_tags from public.skill_tags;
