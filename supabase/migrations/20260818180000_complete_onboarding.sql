-- Finishes onboarding atomically for the authenticated profile.
-- A NULL submitted_links argument means "skip for now" and preserves any
-- existing links; an array replaces the profile's links with the submitted set.

create or replace function public.complete_onboarding(submitted_links jsonb default null)
returns table (onboarding_completed_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  completed_at timestamptz;
begin
  if current_profile_id is null then
    raise exception 'authentication_required';
  end if;

  if submitted_links is not null then
    if jsonb_typeof(submitted_links) <> 'array' then
      raise exception 'submitted_links must be an array';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(submitted_links) as link(value)
      where coalesce(link.value ->> 'type', '') not in ('instagram', 'youtube', 'tiktok', 'outro')
        or coalesce(link.value ->> 'url', '') !~* '^https?://'
        or (
          link.value ->> 'type' = 'outro'
          and coalesce(nullif(trim(link.value ->> 'label'), ''), '') = ''
        )
    ) then
      raise exception 'invalid_profile_link';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(submitted_links) as link(value)
      where link.value ->> 'type' <> 'outro'
      group by link.value ->> 'type'
      having count(*) > 1
    ) then
      raise exception 'duplicate_profile_link_type';
    end if;

    delete from public.profile_links where profile_id = current_profile_id;

    insert into public.profile_links (profile_id, type, label, url)
    select
      current_profile_id,
      link.value ->> 'type',
      nullif(trim(link.value ->> 'label'), ''),
      trim(link.value ->> 'url')
    from jsonb_array_elements(submitted_links) as link(value);
  end if;

  update public.profiles
  set onboarding_completed_at = now()
  where id = current_profile_id
  returning profiles.onboarding_completed_at into completed_at;

  if completed_at is null then
    raise exception 'profile_not_found';
  end if;

  return query select completed_at;
end;
$$;

grant execute on function public.complete_onboarding(jsonb) to authenticated;
