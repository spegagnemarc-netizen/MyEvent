-- Admin V2.1: reviewed BEFORE the first execution of 003.
-- Apply only on the Supabase TEST project used by the Vercel Preview.
-- Run supabase/admin/preflight.sql and save its output first.
-- 003 installs objects; 004 separately activates the PostgREST suspension gate.
-- No remote execution or production activation is implied by this file.
begin;
-- Abort before any mutation if a required legacy column or permission differs.
do $$ declare r record; begin
 for r in select * from (values
 ('auth','users','id'),('auth','users','created_at'),('auth','users','banned_until'),
 ('public','profiles','id'),('public','profiles','display_name'),('public','profiles','username'),('public','profiles','avatar'),
 ('public','events','id'),('public','events','name'),('public','events','creator_id'),('public','events','location'),
 ('public','events','event_date'),('public','events','visibility'),('public','events','created_at'),
 ('public','marketplace_listings','id'),('public','marketplace_listings','owner_id'),('public','marketplace_listings','title'),
 ('public','marketplace_listings','city'),('public','marketplace_listings','status'),('public','marketplace_listings','price_cents'),
 ('public','marketplace_listings','created_at')) as c(s,t,col) loop
  if not exists(select 1 from information_schema.columns where table_schema=r.s and table_name=r.t and column_name=r.col)
  then raise exception 'Admin V2 précontrôle: colonne manquante %.%.%',r.s,r.t,r.col; end if;
 end loop;
 if to_regclass('public.platform_admins') is null or to_regclass('public.admin_partner_content') is null
  then raise exception 'Appliquer les migrations Admin 001 et 002 avant 003'; end if;
 if not has_column_privilege(current_user,'auth.users','banned_until','UPDATE')
  then raise exception 'Le propriétaire des RPC doit pouvoir modifier auth.users.banned_until'; end if;
end $$;
-- Save replaced definitions for a targeted rollback, without deleting admin history.
create table public.admin_v2_install_snapshot (object_name text primary key, definition text not null);
alter table public.admin_v2_install_snapshot enable row level security;
revoke all on public.admin_v2_install_snapshot from public,anon,authenticated;
insert into public.admin_v2_install_snapshot
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p
 where p.oid in ('public.myevent_admin_overview()'::regprocedure,
 'public.event_protect_identity()'::regprocedure,'public.event_is_visible(uuid,uuid)'::regprocedure);
create table public.admin_audit_log (
 id bigint generated always as identity primary key,
 actor_id uuid not null, action text not null,
 target_kind text not null, target_id uuid, detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index admin_audit_recent on public.admin_audit_log(created_at desc);
create table public.admin_account_controls (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false, reason text not null default '',
 previous_banned_until timestamptz, managed_banned_until timestamptz,
 updated_at timestamptz not null default now()
);
create table public.admin_event_controls (
 event_id uuid primary key references public.events(id) on delete cascade,
 hidden boolean not null default false, reason text not null default '',
 updated_at timestamptz not null default now()
);
create table public.admin_listing_controls (
 listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
 hidden boolean not null default false, reason text not null default '',
 updated_at timestamptz not null default now()
);
create table public.admin_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid references auth.users(id) on delete set null,
 target_kind text not null check (target_kind in ('event','listing')),
 target_id uuid not null, reason text not null check (length(trim(reason)) between 10 and 1000),
 status text not null default 'open' check (status in ('open','resolved','dismissed')),
 reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index admin_reports_queue on public.admin_reports(status,created_at desc);
create unique index admin_reports_one_open on public.admin_reports(reporter_id,target_kind,target_id) where status='open';
create table public.admin_partner_registry (
 provider text primary key check (provider in ('getyourguide','viator','booking','ticketnetwork','fnac_spectacles')),
 label text not null, enabled boolean not null default false,
 notes text not null default '', updated_at timestamptz not null default now()
);
insert into public.admin_partner_registry(provider,label,enabled) values
 ('getyourguide','GetYourGuide',true),('viator','Viator',false),('booking','Booking',false),
 ('ticketnetwork','TicketNetwork',false),('fnac_spectacles','Fnac Spectacles',false);
create table public.admin_app_settings (
 key text primary key check (key in ('social','events','marketplace','music','games','stories')),
 enabled boolean not null default true, description text not null default '',
 updated_at timestamptz not null default now()
);
insert into public.admin_app_settings(key,description) values
 ('social','Accueil social'),('events','Événements'),('marketplace','Marketplace'),
 ('music','Musique'),('games','Jeux'),('stories','Stories');
-- No direct grants or client RLS policies on internal admin tables.
do $$ declare t text; begin
 foreach t in array array['admin_audit_log','admin_account_controls','admin_event_controls',
  'admin_listing_controls','admin_reports','admin_partner_registry','admin_app_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on sequence public.admin_audit_log_id_seq from public,anon,authenticated;
-- Catalogue V1 edits also enter the V2 audit trail without changing its RPC.
create function public.myevent_admin_content_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform public.myevent_admin_guard();
 insert into public.admin_audit_log(actor_id,action,target_kind,target_id,detail)
 values(auth.uid(),case when tg_op='INSERT' then 'create' else 'update' end,
  'partner_content',new.id,jsonb_build_object('provider',new.provider,'enabled',new.enabled));
 return new;
end $$;
revoke all on function public.myevent_admin_content_audit() from public,anon,authenticated;
create trigger myevent_admin_content_audit_v2 after insert or update on public.admin_partner_content
 for each row execute function public.myevent_admin_content_audit();

create function public.myevent_admin_guard() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists (select 1 from public.platform_admins
  where user_id=auth.uid() and role='super_admin') or not public.myevent_account_active()
 then raise exception 'Accès administrateur refusé' using errcode='42501'; end if;
end $$;
revoke all on function public.myevent_admin_guard() from public,anon,authenticated;

create or replace function public.myevent_admin_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.myevent_admin_guard();
 return jsonb_build_object(
  'users',(select count(*) from auth.users),
  'events',(select count(*) from public.events),
  'marketplace',(select count(*) from public.marketplace_listings),
  'suspended',(select count(*) from public.admin_account_controls where suspended),
  'suspension_gate_ready',public.myevent_suspension_gate_ready(),
  'open_reports',(select count(*) from public.admin_reports where status='open'),
  'generated_at',now());
end $$;
-- Read-only lists are bounded and return a controlled subset. No auth secrets/emails.
create function public.myevent_admin_list(p_kind text,p_query text default '',p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; q text := left(trim(coalesce(p_query,'')),100); n int := least(greatest(coalesce(p_limit,50),1),100);
begin
 perform public.myevent_admin_guard();
 if p_kind='users' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select u.id,p.display_name,p.username,p.avatar,u.created_at,
    (coalesce(c.suspended,false) or coalesce(u.banned_until>now(),false)) as suspended,
    exists(select 1 from public.platform_admins a where a.user_id=u.id) as is_admin,
    coalesce(c.suspended,false) as managed_suspension
   from auth.users u left join public.profiles p on p.id=u.id
    left join public.admin_account_controls c on c.user_id=u.id
   where q='' or p.display_name ilike '%'||q||'%' or p.username ilike '%'||q||'%' or u.id::text=q
   order by u.created_at desc limit n
  ) x;
 elsif p_kind='events' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select e.id,e.name,e.location,e.event_date,e.visibility,e.creator_id,e.created_at,
    coalesce(c.hidden,false) as hidden, p.display_name as creator_name
   from public.events e left join public.admin_event_controls c on c.event_id=e.id
    left join public.profiles p on p.id=e.creator_id
   where q='' or e.name ilike '%'||q||'%' or e.location ilike '%'||q||'%' or e.id::text=q
   order by e.created_at desc limit n
  ) x;
 elsif p_kind='listings' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select l.id,l.title,l.city,l.status,l.price_cents,l.owner_id,l.created_at,
    coalesce(c.hidden,false) as hidden,p.display_name as owner_name
   from public.marketplace_listings l left join public.admin_listing_controls c on c.listing_id=l.id
    left join public.profiles p on p.id=l.owner_id
   where q='' or l.title ilike '%'||q||'%' or l.city ilike '%'||q||'%' or l.id::text=q
   order by l.created_at desc limit n
  ) x;
 elsif p_kind='reports' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select id,target_kind,target_id,reason,status,created_at,reviewed_at,reporter_id
   from public.admin_reports where q='' or status=q or target_id::text=q
   order by (status='open') desc,created_at desc limit n
  ) x;
 elsif p_kind='audit' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select id,actor_id,action,target_kind,target_id,detail,created_at
   from public.admin_audit_log order by created_at desc limit n
  ) x;
 elsif p_kind='partners' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from
   (select provider,label,enabled,notes,updated_at from public.admin_partner_registry order by provider) x;
 elsif p_kind='settings' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from
   (select key,enabled,description,updated_at from public.admin_app_settings order by key) x;
 else raise exception 'Liste inconnue' using errcode='22023'; end if;
 return result;
end $$;
revoke all on function public.myevent_admin_list(text,text,int) from public,anon;
grant execute on function public.myevent_admin_list(text,text,int) to authenticated;

-- All mutations are validated, atomic and audited; no arbitrary column or table names.
create function public.myevent_admin_action(p_kind text,p_id uuid,p_action text,p_value text default '',p_reason text default '')
returns void language plpgsql security definer set search_path='' as $$
declare new_value boolean; v_ban timestamptz; v_control public.admin_account_controls%rowtype;
 v_reason text := trim(coalesce(p_reason,'')); v_before jsonb; v_after jsonb;
begin
 perform public.myevent_admin_guard();
 if p_id is null or length(v_reason)>500 then raise exception 'Identifiant ou motif invalide' using errcode='22023'; end if;
 if p_kind='user' and p_action in ('suspend','reactivate') then
  if p_id=auth.uid() or exists(select 1 from public.platform_admins where user_id=p_id)
   then raise exception 'Compte administrateur protégé' using errcode='42501'; end if;
  if p_action='suspend' and length(v_reason)<10 then raise exception 'Motif requis (10 caractères minimum)' using errcode='22023'; end if;
  -- Do not activate suspension until the Data API gate covers old DEFINER RPCs.
  if not public.myevent_suspension_gate_ready() then
   raise exception 'Activer et tester la migration 004 sur le projet Preview avant les suspensions' using errcode='55000';
  end if;
  select banned_until into v_ban from auth.users where id=p_id for update;
  if not found then raise exception 'Compte introuvable' using errcode='P0002'; end if;
  select * into v_control from public.admin_account_controls where user_id=p_id for update;
  v_before:=jsonb_build_object('suspended',coalesce(v_control.suspended,false),'banned_until',v_ban);
  new_value:=(p_action='suspend');
  if new_value then
   -- Keep the original ban once; repeated suspension must not overwrite it.
   if not coalesce(v_control.suspended,false) then
    insert into public.admin_account_controls(user_id,suspended,reason,previous_banned_until,managed_banned_until)
    values(p_id,true,v_reason,v_ban,greatest(coalesce(v_ban,now()),now()+interval '100 years'))
    on conflict(user_id) do update set suspended=true,reason=excluded.reason,
     previous_banned_until=excluded.previous_banned_until,managed_banned_until=excluded.managed_banned_until,updated_at=now();
    update auth.users u set banned_until=c.managed_banned_until
     from public.admin_account_controls c where u.id=p_id and c.user_id=u.id;
   end if;
  else
   if not coalesce(v_control.suspended,false) then
    raise exception 'Aucune suspension MyEvent à retirer; les autres bannissements restent protégés' using errcode='22023';
   end if;
   -- A ban edited externally after suspension is left untouched.
   update auth.users set banned_until=v_control.previous_banned_until
    where id=p_id and banned_until is not distinct from v_control.managed_banned_until;
   update public.admin_account_controls set suspended=false,reason=v_reason,updated_at=now() where user_id=p_id;
  end if;
  select jsonb_build_object('suspended',new_value,'banned_until',banned_until) into v_after from auth.users where id=p_id;
 elsif p_kind='event' and p_action in ('hide','restore','visibility') then
  perform 1 from public.events where id=p_id for update;
  if not found then raise exception 'Événement introuvable' using errcode='P0002'; end if;
  if p_action='visibility' then
   if p_value is null or p_value not in ('private','friends','public') then raise exception 'Visibilité invalide' using errcode='22023'; end if;
   select jsonb_build_object('visibility',visibility) into v_before from public.events where id=p_id;
   update public.events set visibility=p_value where id=p_id;
   v_after:=jsonb_build_object('visibility',p_value);
  else
   if p_action='hide' and length(v_reason)<10 then raise exception 'Motif requis (10 caractères minimum)' using errcode='22023'; end if;
   new_value:=(p_action='hide');
   insert into public.admin_event_controls(event_id,hidden,reason) values(p_id,new_value,v_reason)
    on conflict(event_id) do update set hidden=excluded.hidden,reason=excluded.reason,updated_at=now();
  end if;
 elsif p_kind='listing' and p_action in ('hide','restore') then
  perform 1 from public.marketplace_listings where id=p_id for update;
  if not found then raise exception 'Annonce introuvable' using errcode='P0002'; end if;
  if p_action='hide' and length(v_reason)<10 then raise exception 'Motif requis (10 caractères minimum)' using errcode='22023'; end if;
  new_value:=(p_action='hide');
  insert into public.admin_listing_controls(listing_id,hidden,reason) values(p_id,new_value,v_reason)
   on conflict(listing_id) do update set hidden=excluded.hidden,reason=excluded.reason,updated_at=now();
 elsif p_kind='report' and p_action in ('resolve','dismiss','reopen') then
  update public.admin_reports set status=case when p_action='resolve' then 'resolved'
   when p_action='dismiss' then 'dismissed' else 'open' end,
   reviewed_by=case when p_action='reopen' then null else auth.uid() end,
   reviewed_at=case when p_action='reopen' then null else now() end where id=p_id;
  if not found then raise exception 'Signalement introuvable' using errcode='P0002'; end if;
 else raise exception 'Action inconnue' using errcode='22023'; end if;
 insert into public.admin_audit_log(actor_id,action,target_kind,target_id,detail)
 values(auth.uid(),p_action,p_kind,p_id,jsonb_build_object('value',left(coalesce(p_value,''),120),'reason',v_reason,'before',v_before,'after',v_after));
end $$;
revoke all on function public.myevent_admin_action(text,uuid,text,text,text) from public,anon;
grant execute on function public.myevent_admin_action(text,uuid,text,text,text) to authenticated;

create function public.myevent_admin_config(p_kind text,p_key text,p_enabled boolean,p_notes text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.myevent_admin_guard();
 if p_enabled is null or length(coalesce(p_notes,''))>500 then raise exception 'Configuration invalide' using errcode='22023'; end if;
 if p_kind='partner' then
  update public.admin_partner_registry set enabled=p_enabled,notes=coalesce(p_notes,''),updated_at=now() where provider=p_key;
 elsif p_kind='module' then
  update public.admin_app_settings set enabled=p_enabled,updated_at=now() where key=p_key;
 else raise exception 'Configuration inconnue' using errcode='22023'; end if;
 if not found then raise exception 'Clé inconnue' using errcode='P0002'; end if;
 insert into public.admin_audit_log(actor_id,action,target_kind,detail)
 values(auth.uid(),'configure',p_kind,jsonb_build_object('key',p_key,'enabled',p_enabled,'notes',left(coalesce(p_notes,''),500)));
end $$;
revoke all on function public.myevent_admin_config(text,text,boolean,text) from public,anon;
grant execute on function public.myevent_admin_config(text,text,boolean,text) to authenticated;

-- Authenticated members can file a report only for content they can currently access.
create function public.myevent_report(p_kind text,p_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.myevent_account_active() or length(trim(coalesce(p_reason,''))) not between 10 and 1000
  then raise exception 'Signalement invalide' using errcode='22023'; end if;
 if not ((p_kind='event' and public.event_is_visible(p_id)) or
  (p_kind='listing' and exists(select 1 from public.marketplace_listings
   where id=p_id and (status='active' or owner_id=auth.uid()) and not exists
    (select 1 from public.admin_listing_controls where listing_id=p_id and hidden))))
 then raise exception 'Contenu inaccessible' using errcode='42501'; end if;
 insert into public.admin_reports(reporter_id,target_kind,target_id,reason)
 values(auth.uid(),p_kind,p_id,trim(p_reason)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.myevent_report(text,uuid,text) from public,anon;
grant execute on function public.myevent_report(text,uuid,text) to authenticated;

-- The legacy trigger protects ownership; allow ONLY an admin visibility change.
create or replace function public.event_protect_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.creator_id<>auth.uid() then raise exception 'Suppression réservée au propriétaire'; end if;
  return old;
 end if;
 if new.id is distinct from old.id or new.creator_id is distinct from old.creator_id then raise exception 'Le propriétaire ne peut pas être modifié'; end if;
 if new.visibility<>old.visibility and old.creator_id<>auth.uid() and not (public.myevent_is_admin() and current_user=pg_get_userbyid(
  (select proowner from pg_proc where oid='public.myevent_admin_action(text,uuid,text,text,text)'::regprocedure)))
  then raise exception 'Seul le propriétaire règle la visibilité'; end if;
 return new;
end $$;
-- Hidden content cannot re-enter public discovery by owner edits or direct ID lookup.
create or replace function public.event_is_visible(p_event uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from public.events e where e.id=p_event and
  ((public.event_is_member(e.id,p_user)) or
   (not exists(select 1 from public.admin_event_controls c where c.event_id=e.id and c.hidden)
    and (e.visibility='public' or (e.visibility='friends' and public.are_friends(e.creator_id,p_user))))));
$$;
create function public.myevent_listing_not_hidden(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.admin_listing_controls where listing_id=p_id and hidden);
$$;
revoke all on function public.myevent_listing_not_hidden(uuid) from public,anon;
grant execute on function public.myevent_listing_not_hidden(uuid) to authenticated;
create policy admin_listing_visibility_v2 on public.marketplace_listings as restrictive for select to authenticated
 using (owner_id=auth.uid() or public.myevent_listing_not_hidden(id));
create policy admin_listing_publish_v2 on public.marketplace_listings as restrictive for update to authenticated
 using (true) with check (status<>'active' or public.myevent_listing_not_hidden(id));
-- Existing access tokens are also blocked by RLS on direct public tables while GoTrue bans new logins.
create function public.myevent_account_active() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid()
  and (banned_until is null or banned_until<=now()))
  and not exists(select 1 from public.admin_account_controls where user_id=auth.uid() and suspended);
$$;
revoke all on function public.myevent_account_active() from public,anon;
grant execute on function public.myevent_account_active() to authenticated;
-- Explicit application scope: never sweep arbitrary public/extension tables.
-- Missing optional modules are skipped; a present table without RLS aborts.
do $$ declare t text; r regclass; enabled boolean; begin
 foreach t in array array[
 'profiles','events','event_members','friendships','friend_invites','social_stories','social_story_likes',
 'social_posts','event_feed_posts','feed_likes','feed_comments','dm_conversations','dm_messages','dm_reads',
 'social_notifications','social_locations','messages','message_reactions','message_reads','voice_messages',
 'polls','poll_options','poll_votes','media','event_locations','event_outings','event_outing_plans',
 'event_outing_plan_items','event_outing_plan_reservations','event_tasks','event_task_assignees',
 'event_supplies','event_supply_contributions','event_fund_entries','event_fund_settings',
 'event_fund_payment_details','event_hall_settings','marketplace_listings','marketplace_favorites',
 'marketplace_threads','marketplace_messages','music_tracks','music_playlists','music_playlist_items',
 'music_votes','music_favorites','event_music_settings','game_rooms','game_players','game_rounds',
 'game_scores','game_invitations','game_events','game_challenges'] loop
  r:=to_regclass('public.'||t);
  if r is not null then
   select relrowsecurity into enabled from pg_class where oid=r;
   if not enabled then raise exception 'Admin V2 précontrôle: RLS désactivée sur public.% (aucune activation implicite)',t; end if;
   execute format('create policy admin_account_active_v2 on public.%I as restrictive for all to authenticated using ((select public.myevent_account_active())) with check ((select public.myevent_account_active()))',t);
  end if;
 end loop;
end $$;
-- Storage is a separate API: the PostgREST hook does not cover it.
create policy admin_account_active_v2 on storage.objects as restrictive for all to authenticated
 using ((select public.myevent_account_active())) with check ((select public.myevent_account_active()));

-- Gate for EVERY Data API request, including legacy SECURITY DEFINER RPCs.
-- Installation is separate in 004, and refuses to overwrite a pre-existing hook.
create function public.myevent_api_request_guard() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.myevent_account_active() then
  raise exception 'MYEVENT_ACCOUNT_SUSPENDED' using errcode='42501';
 end if;
end $$;
revoke all on function public.myevent_api_request_guard() from public;
grant execute on function public.myevent_api_request_guard() to anon,authenticated,service_role;
create function public.myevent_suspension_gate_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from pg_roles r join pg_db_role_setting s on s.setrole=r.oid,
  lateral unnest(s.setconfig) c(value)
  where r.rolname='authenticator' and s.setdatabase=0
   and c.value='pgrst.db_pre_request=public.myevent_api_request_guard')
 and not exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
  lateral unnest(s.setconfig) c(value)
  where r.rolname='authenticator' and s.setdatabase=(select oid from pg_database where datname=current_database())
   and c.value like 'pgrst.db_pre_request=%' and c.value<>'pgrst.db_pre_request=public.myevent_api_request_guard');
$$;
revoke all on function public.myevent_suspension_gate_ready() from public,anon,authenticated;
-- Replaced functions keep their original grants; explicitly close trigger entry points.
revoke all on function public.event_protect_identity() from public,anon,authenticated;
commit;
