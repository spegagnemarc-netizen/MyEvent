-- Return membership rows keyed by their real auth.users UUID, including rows
-- whose profile is missing, so the UI never invents an identity for a role.
create or replace function public.event_member_directory(p_event_id uuid)
returns table(member_id uuid, display_name text, username text, avatar text,
  has_profile boolean, nickname text, role text, status text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name::text, p.username::text, p.avatar::text,
    p.id is not null, m.nickname::text, m.role::text, m.status::text, m.joined_at
  from public.event_members m left join public.profiles p on p.id=m.user_id
  where m.event_id=p_event_id and public.event_is_member(p_event_id)
  order by m.joined_at, m.user_id
  limit 500;
$$;
revoke all on function public.event_member_directory(uuid) from public;
grant execute on function public.event_member_directory(uuid) to authenticated;

create or replace function public.event_member_coorg_identity_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' and auth.uid() is not null and new.user_id<>auth.uid() then
    raise exception 'Le participant doit correspondre au compte connecté';
  end if;
  if new.role='coorganizer' and (tg_op='INSERT' or new.role is distinct from old.role)
    and not exists(select 1 from public.profiles p where p.id=new.user_id
      and nullif(trim(coalesce(p.username,p.display_name)), '') is not null) then
    raise exception 'Impossible de promouvoir un compte sans profil identifiable';
  end if;
  return new;
end $$;
create trigger event_member_coorg_identity_guard_v3 before insert or update on public.event_members
for each row execute function public.event_member_coorg_identity_guard();

-- The former RPC accepted a membership UUID even if that row did not have a
-- profile. Keep the name for compatibility but refuse unidentified rows.
create or replace function public.set_event_coorganizer(p_event_id uuid,p_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select creator_id into owner_id from public.events where id=p_event_id for update;
  if owner_id is null or owner_id<>auth.uid() or p_user_id=owner_id then
    raise exception 'Action réservée au propriétaire';
  end if;
  if p_enabled and not exists(select 1 from public.profiles p where p.id=p_user_id
      and nullif(trim(coalesce(p.username,p.display_name)), '') is not null) then
    raise exception 'Ce participant n’a pas de profil identifiable. Vérifiez son compte avant de lui donner un rôle.';
  end if;
  update public.event_members set role=case when p_enabled then 'coorganizer' else 'member' end
    where event_id=p_event_id and user_id=p_user_id and role in ('member','participant','coorganizer');
  if not found then raise exception 'Participant introuvable'; end if;
end $$;
revoke all on function public.set_event_coorganizer(uuid,uuid,boolean) from public;
grant execute on function public.set_event_coorganizer(uuid,uuid,boolean) to authenticated;

-- The client supplies the username seen on the selected row as an additional
-- stale-selection guard. The server checks it against that same user UUID.
create or replace function public.set_event_coorganizer_verified(
  p_event_id uuid,p_user_id uuid,p_username text,p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_username is null or not exists(select 1 from public.profiles p
    where p.id=p_user_id and p.username=p_username) then
    raise exception 'Identité du participant modifiée. Rechargez la liste.';
  end if;
  perform public.set_event_coorganizer(p_event_id,p_user_id,p_enabled);
end $$;
revoke all on function public.set_event_coorganizer_verified(uuid,uuid,text,boolean) from public;
grant execute on function public.set_event_coorganizer_verified(uuid,uuid,text,boolean) to authenticated;
