alter table public.user_skills
  add column if not exists experience_level text;

alter table public.user_skills
  drop constraint if exists user_skills_experience_level_check;

alter table public.user_skills
  add constraint user_skills_experience_level_check
  check (experience_level is null or experience_level in ('iniciante', 'intermediario', 'experiente'));
