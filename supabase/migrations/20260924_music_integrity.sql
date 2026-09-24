-- Non-destructive: existing mismatches remain available for explicit audit.
-- NOT VALID foreign keys still enforce every new write. Validate after auditing.
begin;
create unique index if not exists music_playlists_id_event_unique on public.music_playlists(id,event_id);
create unique index if not exists music_items_id_event_unique on public.music_playlist_items(id,event_id);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='music_items_playlist_event_fk' and conrelid='public.music_playlist_items'::regclass) then
    alter table public.music_playlist_items add constraint music_items_playlist_event_fk foreign key(playlist_id,event_id) references public.music_playlists(id,event_id) on delete cascade not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='music_votes_item_event_fk' and conrelid='public.music_votes'::regclass) then
    alter table public.music_votes add constraint music_votes_item_event_fk foreign key(playlist_item_id,event_id) references public.music_playlist_items(id,event_id) on delete cascade not valid;
  end if;
end $$;

create or replace function public.music_guard_item() returns trigger language plpgsql security definer set search_path=public as $$
declare target_event uuid; target_playlist uuid; locked boolean; enabled boolean;
begin
  if tg_op='DELETE' then target_event=old.event_id;target_playlist=old.playlist_id;
  else target_event=new.event_id;target_playlist=new.playlist_id;end if;
  if tg_op='UPDATE' and (new.event_id,new.playlist_id,new.track_id,new.proposed_by) is distinct from (old.event_id,old.playlist_id,old.track_id,old.proposed_by) then
    raise exception 'Music item identity is immutable';
  end if;
  select is_locked into locked from public.music_playlists where id=target_playlist and event_id=target_event for share;
  select proposals_enabled into enabled from public.event_music_settings where event_id=target_event;
  if not public.myevent_music_event_owner(target_event) and (coalesce(locked,false) or (tg_op='INSERT' and not coalesce(enabled,true)) or (tg_op<>'INSERT' and old.is_locked)) then
    raise exception 'This music queue or item is locked';
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists music_guard_item on public.music_playlist_items;
create trigger music_guard_item before insert or update or delete on public.music_playlist_items for each row execute function public.music_guard_item();

create or replace function public.music_guard_vote() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and (new.event_id,new.playlist_item_id,new.user_id) is distinct from (old.event_id,old.playlist_item_id,old.user_id) then raise exception 'Music vote identity is immutable';end if;
  if exists(select 1 from public.event_music_settings where event_id=new.event_id and not votes_enabled) then raise exception 'Votes are disabled for this event';end if;
  return new;
end $$;
drop trigger if exists music_guard_vote on public.music_votes;
create trigger music_guard_vote before insert or update on public.music_votes for each row execute function public.music_guard_vote();

-- Swap the complete queue atomically; reject stale/incomplete clients.
create or replace function public.music_reorder_queue(target_event uuid,target_playlist uuid,item_ids uuid[]) returns void
language plpgsql security invoker set search_path=public as $$
declare existing_ids uuid[]; locked_id uuid; old_order uuid[];
begin
  if not public.myevent_music_event_owner(target_event) then raise exception 'Event owner required';end if;
  perform 1 from public.music_playlists where id=target_playlist and event_id=target_event for update;
  if not found then raise exception 'Playlist unavailable';end if;
  select array_agg(id order by id),array_agg(id order by position nulls last,created_at,id) into existing_ids,old_order from public.music_playlist_items where event_id=target_event and playlist_id=target_playlist;
  if (select array_agg(v order by v) from unnest(item_ids) v) is distinct from existing_ids then raise exception 'Queue changed; refresh before reordering';end if;
  for locked_id in select id from public.music_playlist_items where event_id=target_event and playlist_id=target_playlist and is_locked loop
    if array_position(old_order,locked_id)<>array_position(item_ids,locked_id) then raise exception 'Unlock the item before moving it';end if;
  end loop;
  update public.music_playlist_items i set position=u.ordinality::integer from unnest(item_ids) with ordinality u(id,ordinality) where i.id=u.id and i.event_id=target_event and i.playlist_id=target_playlist;
end $$;
revoke all on function public.music_reorder_queue(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.music_reorder_queue(uuid,uuid,uuid[]) to authenticated;
commit;
