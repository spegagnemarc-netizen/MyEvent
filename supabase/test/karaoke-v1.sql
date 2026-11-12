begin;

alter table public.game_rooms drop constraint game_rooms_game_key_check;
alter table public.game_rooms add constraint game_rooms_game_key_check
  check (game_key in ('infiltre','defis','truth','treasure','quiz','blind','karaoke'));

create function public.karaoke_create(options jsonb default '{}', target_event uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null or target_event is not null then raise exception 'Connexion requise pour un salon privé'; end if;
  if (select count(*) from public.game_rooms where host_id=uid and expires_at>now() and status in ('waiting','playing')) >= 5 then
    raise exception 'Fermez un salon avant d’en créer un autre';
  end if;
  insert into public.game_rooms(host_id,game_key,settings)
    values(uid,'karaoke','{"players":6}') returning id into rid;
  insert into public.game_players(room_id,user_id) values(rid,uid);
  return rid;
end $$;

create function public.karaoke_join(invitation_code text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.game_rooms where code=upper(trim(invitation_code)) and game_key='karaoke'
  ) then
    raise exception 'Code de karaoké invalide';
  end if;
  return public.game_join(invitation_code);
end $$;

create function public.karaoke_action(target_room uuid, action text, data jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  room public.game_rooms%rowtype;
  queue jsonb;
  actor uuid;
  target uuid;
  points_text text := data->>'score';
  next_turn integer;
begin
  select * into room from public.game_rooms where id=target_room and game_key='karaoke' for update;
  if uid is null or room.id is null or not public.game_is_member(target_room) then
    raise exception 'Salon inaccessible ou expiré';
  end if;
  queue := room.settings->'queue';
  actor := (queue->>(room.round_no-1))::uuid;
  update public.game_players set last_seen=now() where room_id=room.id and user_id=uid;

  if action='heartbeat' then
    return;
  elsif action='invite' then
    target := (data->>'target')::uuid;
    if room.status<>'waiting' or target is null or target=uid or public.are_friends(uid,target) is not true then
      raise exception 'Invitation non autorisée';
    end if;
    insert into public.game_invitations(room_id,user_id,invited_by)
      values(room.id,target,uid) on conflict do nothing;
  elsif action='start' then
    select jsonb_agg(user_id order by joined_at,user_id) into queue
      from public.game_players where room_id=room.id and left_at is null;
    if room.status<>'waiting' or room.host_id<>uid or coalesce(jsonb_array_length(queue),0)<2 then
      raise exception 'L’hôte peut lancer la partie à partir de deux joueurs';
    end if;
    update public.game_rooms set status='playing',round_no=1,
      settings=jsonb_set(settings,'{queue}',queue) where id=room.id;
  elsif action in ('finish','skip') then
    if room.status<>'playing' or (data->>'turn')::integer is distinct from room.round_no
       or (uid is distinct from actor and (action<>'skip' or uid<>room.host_id)) then
      raise exception 'Ce tour est terminé ou appartient à un autre joueur';
    end if;
    if action='finish' and points_text is not null then
      if jsonb_typeof(data->'score') <> 'number' or points_text !~ '^(100|[0-9]{1,2})$' then
        raise exception 'Score invalide';
      end if;
      insert into public.game_scores(room_id,round_no,user_id,reason,points)
        values(room.id,room.round_no,uid,'justesse',points_text::integer);
    end if;
  elsif action='leave' then
    update public.game_players set left_at=now(),ready=false where room_id=room.id and user_id=uid;
    select user_id into target from public.game_players where room_id=room.id and left_at is null order by joined_at,user_id limit 1;
    if target is null then
      update public.game_rooms set status='closed' where id=room.id;
      update public.game_rooms set revision=revision+1 where id=room.id;
      return;
    elsif room.host_id=uid then
      update public.game_rooms set host_id=target where id=room.id;
    end if;
  else
    raise exception 'Action inconnue';
  end if;

  if room.status='playing' and (action in ('finish','skip') or (action='leave' and uid=actor)) then
    select min(q.position)::integer into next_turn
      from jsonb_array_elements_text(queue) with ordinality q(player,position)
      join public.game_players p on p.user_id=q.player::uuid and p.room_id=room.id and p.left_at is null
      where q.position>room.round_no;
    if next_turn is null then
      update public.game_rooms set status='finished' where id=room.id;
    else
      update public.game_rooms set round_no=next_turn where id=room.id;
    end if;
  end if;

  update public.game_rooms set revision=revision+1 where id=room.id;
end $$;

revoke all on function public.karaoke_create(jsonb,uuid), public.karaoke_join(text), public.karaoke_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.karaoke_create(jsonb,uuid), public.karaoke_join(text), public.karaoke_action(uuid,text,jsonb) to authenticated;

commit;
