-- TEST: match existing event membership statuses; never admit pending/inactive guests.
begin;
create or replace function game_private.event_member(eid uuid,uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events where id=eid and creator_id=uid)
 or exists(select 1 from public.event_members m where m.event_id=eid and m.user_id=uid
  and (not (to_jsonb(m)?'status') or to_jsonb(m)->>'status' in ('active','confirmed')))
$$;
create or replace function public.game_is_member(target_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.game_players p join public.game_rooms r on r.id=p.room_id
 where p.room_id=target_room and p.user_id=auth.uid() and p.left_at is null and r.expires_at>now()
 and (r.event_id is null or game_private.event_member(r.event_id,auth.uid())))
$$;
notify pgrst,'reload schema';
commit;
