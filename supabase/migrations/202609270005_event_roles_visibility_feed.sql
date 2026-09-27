-- Existing events stay private. Full event rows (including invite_code) remain member-only.
alter table public.events add column if not exists visibility text not null default 'private';
update public.events set visibility='private' where visibility is null or visibility not in ('private','friends','public');
alter table public.events drop constraint if exists events_visibility_check;
alter table public.events add constraint events_visibility_check check (visibility in ('private','friends','public'));

create or replace function public.event_is_member(p_event uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists(select 1 from public.events e where e.id=p_event and e.creator_id=p_user)
    or p_user is not null and exists(select 1 from public.event_members m where m.event_id=p_event and m.user_id=p_user);
$$;
create or replace function public.event_is_manager(p_event uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and (exists(select 1 from public.events e where e.id=p_event and e.creator_id=p_user)
    or exists(select 1 from public.event_members m where m.event_id=p_event and m.user_id=p_user and m.role='coorganizer'));
$$;
create or replace function public.event_is_visible(p_event uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists(select 1 from public.events e where e.id=p_event and
    (e.visibility='public' or (e.visibility='friends' and public.are_friends(e.creator_id,p_user))
      or public.event_is_member(e.id,p_user)));
$$;
revoke all on function public.event_is_member(uuid,uuid),public.event_is_manager(uuid,uuid),public.event_is_visible(uuid,uuid) from public;
grant execute on function public.event_is_member(uuid,uuid),public.event_is_manager(uuid,uuid),public.event_is_visible(uuid,uuid) to authenticated;

-- Restrictive policies also constrain any older permissive policies on the legacy tables.
alter table public.events enable row level security;
create policy event_member_read_v2 on public.events for select to authenticated using (public.event_is_member(id));
create policy event_member_guard_v2 on public.events as restrictive for select using (public.event_is_member(id));
create policy event_manager_update_v2 on public.events for update to authenticated using (public.event_is_manager(id)) with check (public.event_is_manager(id));
create policy event_manager_guard_v2 on public.events as restrictive for update using (public.event_is_manager(id)) with check (public.event_is_manager(id));
create policy event_owner_delete_guard_v2 on public.events as restrictive for delete using (creator_id=auth.uid());
create policy event_owner_insert_guard_v2 on public.events as restrictive for insert with check (creator_id=auth.uid());

create or replace function public.event_protect_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then
    if old.creator_id<>auth.uid() then raise exception 'Suppression réservée au propriétaire'; end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    if new.id<>old.id or new.creator_id<>old.creator_id then raise exception 'Le propriétaire ne peut pas être modifié'; end if;
    if new.visibility<>old.visibility and old.creator_id<>auth.uid() then raise exception 'Seul le propriétaire règle la visibilité'; end if;
  end if;
  return new;
end $$;

-- A guessed event UUID must not expose related private records through an older broad policy.
do $$ declare t text; begin
  foreach t in array array['messages','polls','poll_votes','media','event_outings','event_outing_plans',
    'event_locations','event_fund_entries','event_fund_settings','event_fund_payment_details',
    'event_outing_plan_items','event_outing_plan_reservations','voice_messages'] loop
    if to_regclass('public.'||t) is not null and exists(select 1 from information_schema.columns
      where table_schema='public' and table_name=t and column_name='event_id') then
      execute format('create policy event_scope_read_v2 on public.%I as restrictive for select using (public.event_is_member(event_id))',t);
    end if;
  end loop;
end $$;
do $$ begin
  if to_regclass('public.poll_options') is not null then
    create policy event_poll_options_scope_v2 on public.poll_options as restrictive for select
      using (exists(select 1 from public.polls p where p.id=poll_id and public.event_is_member(p.event_id)));
  end if;
  if to_regclass('public.event_outing_plan_items') is not null then
    create policy event_plan_items_scope_v2 on public.event_outing_plan_items as restrictive for select
      using (exists(select 1 from public.event_outing_plans p where p.id=plan_id and public.event_is_member(p.event_id)));
  end if;
end $$;
create trigger event_protect_identity_v2 before update or delete on public.events for each row execute function public.event_protect_identity();

-- Legacy role constraints are expanded without assuming a particular constraint name.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.event_members'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%role%' loop
    execute format('alter table public.event_members drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.event_members add constraint event_member_role_v2 check (role in ('owner','member','participant','coorganizer'));

create or replace function public.event_member_guard() returns trigger language plpgsql set search_path = '' as $$
declare owner_id uuid;
begin
  select creator_id into owner_id from public.events where id=coalesce(new.event_id,old.event_id);
  if tg_op='DELETE' then
    if owner_id is null then return old; end if; -- Parent event is being deleted.
    if old.user_id=owner_id then raise exception 'Le propriétaire ne peut pas quitter cet événement'; end if;
    if old.role='coorganizer' and old.user_id<>auth.uid() and auth.uid()<>owner_id then raise exception 'Retrait du co-organisateur réservé au propriétaire'; end if;
    if old.user_id<>auth.uid() and not public.event_is_manager(old.event_id) then raise exception 'Gestion des participants interdite'; end if;
    return old;
  end if;
  if tg_op='INSERT' then
    if new.user_id=owner_id then
      if auth.uid()<>owner_id then raise exception 'Rôle propriétaire réservé'; end if;
      new.role='owner';
    elsif new.role not in ('member','participant') then raise exception 'Promotion réservée au propriétaire'; end if;
  else
    if new.event_id<>old.event_id or new.user_id<>old.user_id then raise exception 'Identité du participant immuable'; end if;
    if old.user_id=owner_id or new.role='owner' or old.role='owner' then raise exception 'Propriétaire protégé'; end if;
    if new.role<>old.role and auth.uid()<>owner_id then raise exception 'Promotion réservée au propriétaire'; end if;
    if new.nickname is distinct from old.nickname and auth.uid() not in (new.user_id,owner_id)
      and not public.event_is_manager(new.event_id) then raise exception 'Modification interdite'; end if;
  end if;
  return new;
end $$;
create trigger event_member_guard_v2 before insert or update or delete on public.event_members for each row execute function public.event_member_guard();
alter table public.event_members enable row level security;
create policy event_members_read_v2 on public.event_members for select to authenticated using (public.event_is_member(event_id));
create policy event_members_read_guard_v2 on public.event_members as restrictive for select using (public.event_is_member(event_id));
create policy event_members_insert_guard_v2 on public.event_members as restrictive for insert
  with check (user_id=auth.uid() and public.event_is_visible(event_id));
create policy event_members_update_v2 on public.event_members for update to authenticated using (public.event_is_manager(event_id)) with check (public.event_is_manager(event_id));
create policy event_members_update_guard_v2 on public.event_members as restrictive for update using (public.event_is_manager(event_id)) with check (public.event_is_manager(event_id));
create policy event_members_delete_guard_v2 on public.event_members as restrictive for delete using (user_id=auth.uid() or public.event_is_manager(event_id));

create or replace function public.set_event_coorganizer(p_event_id uuid,p_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select creator_id into owner_id from public.events where id=p_event_id for update;
  if owner_id is null or owner_id<>auth.uid() or p_user_id=owner_id then raise exception 'Action réservée au propriétaire'; end if;
  update public.event_members set role=case when p_enabled then 'coorganizer' else 'member' end
    where event_id=p_event_id and user_id=p_user_id and role in ('member','participant','coorganizer');
  if not found then raise exception 'Participant introuvable'; end if;
end $$;
revoke all on function public.set_event_coorganizer(uuid,uuid,boolean) from public;
grant execute on function public.set_event_coorganizer(uuid,uuid,boolean) to authenticated;

create or replace function public.remove_event_participant(p_event_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select creator_id into owner_id from public.events where id=p_event_id;
  if owner_id is null or p_user_id=owner_id or p_user_id=auth.uid()
    or not public.event_is_manager(p_event_id) then raise exception 'Retrait interdit'; end if;
  if owner_id<>auth.uid() and exists(select 1 from public.event_members
    where event_id=p_event_id and user_id=p_user_id and role='coorganizer') then raise exception 'Un co-organisateur ne peut pas retirer un autre co-organisateur'; end if;
  delete from public.event_members where event_id=p_event_id and user_id=p_user_id;
  if not found then raise exception 'Participant introuvable'; end if;
end $$;
revoke all on function public.remove_event_participant(uuid,uuid) from public;
grant execute on function public.remove_event_participant(uuid,uuid) to authenticated;

-- Admin-only mutations on existing event content; participants still create messages,
-- media and votes under their existing policies. RLS is applied only to tables present.
create or replace function public.event_admin_guard() returns trigger language plpgsql set search_path = '' as $$
declare target_id uuid;
begin
  if tg_op='UPDATE' then
    if tg_table_name='event_outing_plan_items' and new.plan_id is distinct from old.plan_id
      or tg_table_name='poll_options' and new.poll_id is distinct from old.poll_id then
      raise exception 'Le parent ne peut pas être modifié';
    end if;
    if tg_table_name not in ('event_outing_plan_items','poll_options') and new.event_id is distinct from old.event_id then
      raise exception 'L’événement ne peut pas être modifié';
    end if;
  end if;
  if tg_table_name='event_outing_plan_items' then
    select p.event_id into target_id from public.event_outing_plans p where p.id=coalesce(new.plan_id,old.plan_id);
  elsif tg_table_name='poll_options' then
    select p.event_id into target_id from public.polls p where p.id=coalesce(new.poll_id,old.poll_id);
  else
    target_id=coalesce(new.event_id,old.event_id);
  end if;
  if target_id is not null and not public.event_is_manager(target_id) then
    raise exception 'Gestion réservée au créateur ou aux co-organisateurs';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['polls','poll_options','event_outings','event_outing_plans','event_outing_plan_items'] loop
    if to_regclass('public.'||t) is not null then
      execute format('create trigger event_admin_guard_v2 before insert or update or delete on public.%I for each row execute function public.event_admin_guard()',t);
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='event_id') then
        execute format('create policy event_admin_insert_v2 on public.%I as restrictive for insert with check (public.event_is_manager(event_id))',t);
        execute format('create policy event_admin_update_v2 on public.%I as restrictive for update using (public.event_is_manager(event_id)) with check (public.event_is_manager(event_id))',t);
        execute format('create policy event_admin_delete_v2 on public.%I as restrictive for delete using (public.event_is_manager(event_id))',t);
      end if;
    end if;
  end loop;
end $$;

create table public.event_feed_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade, body text not null default '',
  created_at timestamptz not null default now(), check (char_length(body)<=2000),
  check (event_id is not null or char_length(trim(body))>0)
);
create index event_feed_posts_recent_v2 on public.event_feed_posts(created_at desc);
alter table public.event_feed_posts enable row level security;
create policy event_feed_read_v2 on public.event_feed_posts for select to authenticated using
  (event_id is null or public.event_is_visible(event_id));
create policy event_feed_write_v2 on public.event_feed_posts for insert to authenticated with check
  (author_id=auth.uid() and (event_id is null or exists(select 1 from public.events e where e.id=event_id
    and e.creator_id=auth.uid() and e.visibility in ('public','friends'))));
create policy event_feed_delete_v2 on public.event_feed_posts for delete to authenticated using (author_id=auth.uid());
grant select,insert,delete on public.event_feed_posts to authenticated;

-- SECURITY DEFINER exposes just the fields needed for discovery, never invite_code.
create or replace function public.event_social_feed(p_limit int default 30)
returns table(post_id uuid,event_id uuid,author_id uuid,body text,created_at timestamptz,
  author_name text,author_avatar text,event_name text,event_date timestamptz,event_location text,
  event_cover text,event_type text,visibility text,is_member boolean)
language sql stable security definer set search_path = '' as $$
  select p.id,p.event_id,p.author_id,p.body,p.created_at,
    coalesce(nullif(pr.display_name,''),pr.username,'Membre MyEvent')::text,pr.avatar::text,
    e.name::text,e.event_date,e.location::text,e.cover_url::text,e.event_type::text,e.visibility::text,
    case when e.id is null then false else public.event_is_member(e.id) end
  from public.event_feed_posts p left join public.events e on e.id=p.event_id
    left join public.profiles pr on pr.id=p.author_id
  where auth.uid() is not null and (p.event_id is null or (e.id is not null and public.event_is_visible(e.id)))
  order by p.created_at desc limit least(greatest(coalesce(p_limit,30),1),100);
$$;
revoke all on function public.event_social_feed(int) from public;
grant execute on function public.event_social_feed(int) to authenticated;

create or replace function public.join_visible_event(p_event_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.event_is_visible(p_event_id) then raise exception 'Événement inaccessible'; end if;
  if not exists(select 1 from public.event_members where event_id=p_event_id and user_id=auth.uid()) then
    insert into public.event_members(event_id,user_id,role) values(p_event_id,auth.uid(),'member');
  end if;
  return p_event_id;
end $$;
revoke all on function public.join_visible_event(uuid) from public;
grant execute on function public.join_visible_event(uuid) to authenticated;

-- Public/friends covers are accessible only while the event remains visible.
create policy event_cover_visible_v2 on storage.objects for select to authenticated using
  (bucket_id='event-media' and exists(select 1 from public.events e where e.cover_url=name
    and public.event_is_visible(e.id)));
create policy event_media_scope_v2 on storage.objects as restrictive for select using
  (bucket_id<>'event-media' or exists(select 1 from public.events e where e.id::text=split_part(name,'/',1)
    and (public.event_is_member(e.id) or (e.cover_url=name and public.event_is_visible(e.id)))));
