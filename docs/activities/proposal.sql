-- PROPOSAL ONLY. Not in supabase/migrations; never applied remotely.
-- Target authorised for later review: ahyyknfjsielnqyoxqgh exclusively.
-- Incomplete activation: chat, Storage, notifications inbox and age procedure need validation.
-- Run in a transaction only after explicit authorisation and fresh schema comparison.
begin;
create schema activities_private;
revoke all on schema activities_private from public,anon,authenticated;
grant usage on schema activities_private to authenticated;
create table activities_private.settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into activities_private.settings values(true,false);
-- Administrative eligibility decision; never populated from editable user_metadata.
-- No UI grants itself eligibility. TEST fixtures may be approved explicitly by an administrator.
create table activities_private.adult_access(user_id uuid primary key references auth.users(id) on delete cascade,approved_by uuid not null references auth.users(id),approved_at timestamptz not null default now(),revoked_at timestamptz);
create table activities_private.activities(
 id uuid primary key default gen_random_uuid(),organizer_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 120),description text not null check(length(trim(description)) between 1 and 4000),
 category text not null check(category in ('restaurant','randonnee','cinema','bowling','sport','jeux','culture','famille','autres')),
 starts_at timestamptz not null,city text not null check(length(trim(city)) between 1 and 100),venue text not null default '' check(length(venue)<=200),
 capacity integer not null check(capacity between 2 and 100),visibility text not null check(visibility in ('public','friends')),
 join_mode text not null check(join_mode in ('direct','approval')),cost_mode text not null check(cost_mode in ('free','on_site')),
 cost_amount numeric(8,2),conditions text not null default '' check(length(conditions)<=2000),
 status text not null default 'open' check(status in ('open','cancelled','deleted','hidden')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((cost_mode='free' and cost_amount is null) or (cost_mode='on_site' and cost_amount is not null and cost_amount>0 and cost_amount<=10000))
);
create index activities_discovery on activities_private.activities(status,starts_at);
create index activities_owner on activities_private.activities(organizer_id,created_at);
create table activities_private.locations(
 activity_id uuid primary key references activities_private.activities(id) on delete cascade,
 address text not null default '' check(length(address)<=300),latitude double precision,longitude double precision,
 check((latitude is null and longitude is null) or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180))
);
create table activities_private.members(
 activity_id uuid not null references activities_private.activities(id) on delete cascade,user_id uuid not null references auth.users(id),
 status text not null check(status in ('accepted','pending','declined','left')),updated_at timestamptz not null default now(),primary key(activity_id,user_id)
);
create index activity_member_user on activities_private.members(user_id,status);
create table activities_private.blocks(user_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,blocked_id),check(user_id<>blocked_id));
-- Single recipient/event/version uniqueness prevents duplicate notices on retry.
-- A future inbox adapter must consume these rows, rather than generate notices again.
create table activities_private.notices(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,activity_id uuid not null references activities_private.activities(id),kind text not null,version timestamptz not null default now(),created_at timestamptz not null default now(),unique(user_id,activity_id,kind,version));
-- No direct table access, including from PostgREST; RLS default-deny is defense in depth.
do $$declare t text;begin
 foreach t in array array['settings','adult_access','activities','locations','members','blocks','notices'] loop
  execute format('alter table activities_private.%I enable row level security',t);
  execute format('revoke all on activities_private.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on all sequences in schema activities_private from public,anon,authenticated;
create function activities_private.allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.myevent_account_active() and exists(select 1 from activities_private.settings where enabled) and exists(select 1 from activities_private.adult_access where user_id=auth.uid() and revoked_at is null)
$$;
create function activities_private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from activities_private.blocks where (user_id=a and blocked_id=b) or (user_id=b and blocked_id=a))
$$;
create function activities_private.visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select activities_private.allowed() and exists(select 1 from activities_private.activities a where a.id=p_id and a.status<>'deleted' and not activities_private.blocked(a.organizer_id,auth.uid()) and (a.organizer_id=auth.uid() or (a.status<>'hidden' and (a.visibility='public' or public.are_friends(a.organizer_id,auth.uid()) or exists(select 1 from activities_private.members m where m.activity_id=a.id and m.user_id=auth.uid() and m.status='accepted')))))
$$;
create function activities_private.capabilities() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',coalesce((select enabled from activities_private.settings),false),'adult_access',auth.uid() is not null and public.myevent_account_active() and exists(select 1 from activities_private.adult_access where user_id=auth.uid() and revoked_at is null),'version',1)
$$;
create function activities_private.detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a activities_private.activities%rowtype; me uuid:=auth.uid(); accepted boolean; owner boolean; result jsonb;
begin
 if not activities_private.visible(p_id) then return null; end if;
 select * into a from activities_private.activities where id=p_id;
 owner:=a.organizer_id=me;
 accepted:=owner or exists(select 1 from activities_private.members where activity_id=p_id and user_id=me and status='accepted');
 select to_jsonb(a)-'created_at'-'updated_at' || jsonb_build_object(
  'is_owner',owner,'membership',(select status from activities_private.members where activity_id=p_id and user_id=me),
  'participants_count',(select count(*) from activities_private.members where activity_id=p_id and status='accepted'),
  'remaining',greatest(0,a.capacity-(select count(*) from activities_private.members where activity_id=p_id and status='accepted')),
  'address',case when accepted then l.address else null end,
  'position',case when l.latitude is null then null else jsonb_build_object('lat',round(l.latitude::numeric,2),'lon',round(l.longitude::numeric,2)) end,
  'members',case when accepted then coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'status',m.status,'display_name',coalesce(p.display_name,'Participant'))) from activities_private.members m left join public.profiles p on p.id=m.user_id where m.activity_id=p_id and (m.status='accepted' or (owner and m.status='pending')) and not activities_private.blocked(me,m.user_id)),'[]'::jsonb) else '[]'::jsonb end)
 into result from activities_private.locations l where l.activity_id=p_id;
 return result;
end $$;
create function activities_private.list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.detail order by x.starts_at),'[]'::jsonb) from (
 select a.starts_at,activities_private.detail(a.id)-'members'-'address'-'description'-'conditions' as detail
 from activities_private.activities a where activities_private.visible(a.id) and (a.starts_at>now() or a.organizer_id=auth.uid() or exists(select 1 from activities_private.members m where m.activity_id=a.id and m.user_id=auth.uid() and m.status in ('accepted','pending'))) order by a.starts_at limit 300) x
$$;
create function activities_private.save(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); id uuid:=coalesce(p_id,gen_random_uuid()); n integer; a activities_private.activities%rowtype;
begin
 if not activities_private.allowed() then raise exception 'Accès adulte TEST non autorisé'; end if;
 -- Serialises creations per organiser, so the daily limit cannot race.
 perform pg_advisory_xact_lock(hashtextextended('activity-create:'||me::text,0));
 if p_id is null then
  select count(*) into n from activities_private.activities where organizer_id=me and created_at>now()-interval '1 day';
  if n>=5 then raise exception 'Limite de 5 créations par jour atteinte'; end if;
 else
  select * into a from activities_private.activities where activities.id=p_id for update;
  if not found or a.organizer_id<>me or a.status<>'open' then raise exception 'Modification non autorisée'; end if;
  select count(*) into n from activities_private.members where activity_id=p_id and status='accepted';
  if (p_data->>'capacity')::integer<n then raise exception 'Capacité inférieure au nombre de participants'; end if;
 end if;
 if (p_data->>'starts_at')::timestamptz<=now() then raise exception 'Date future requise'; end if;
 insert into activities_private.activities(id,organizer_id,title,description,category,starts_at,city,venue,capacity,visibility,join_mode,cost_mode,cost_amount,conditions)
 values(id,me,trim(p_data->>'title'),trim(p_data->>'description'),p_data->>'category',(p_data->>'starts_at')::timestamptz,trim(p_data->>'city'),coalesce(p_data->>'venue',''),(p_data->>'capacity')::integer,p_data->>'visibility',p_data->>'join_mode',p_data->>'cost_mode',case when p_data->>'cost_mode'='on_site' then (p_data->>'cost_amount')::numeric else null end,coalesce(p_data->>'conditions',''))
 on conflict on constraint activities_pkey do update set title=excluded.title,description=excluded.description,category=excluded.category,starts_at=excluded.starts_at,city=excluded.city,venue=excluded.venue,capacity=excluded.capacity,visibility=excluded.visibility,join_mode=excluded.join_mode,cost_mode=excluded.cost_mode,cost_amount=excluded.cost_amount,conditions=excluded.conditions,updated_at=clock_timestamp();
 insert into activities_private.locations(activity_id,address,latitude,longitude) values(id,coalesce(p_data->>'address',''),(p_data->>'latitude')::double precision,(p_data->>'longitude')::double precision)
 on conflict(activity_id) do update set address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude;
 if p_id is null then insert into activities_private.members values(id,me,'accepted',now());
 else insert into activities_private.notices(user_id,activity_id,kind) select user_id,id,'updated' from activities_private.members where activity_id=id and user_id<>me and status in ('accepted','pending') on conflict do nothing;
 end if;
 return id;
end $$;
create function activities_private.participate(p_id uuid,p_action text,p_user uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();a activities_private.activities%rowtype;target uuid:=coalesce(p_user,auth.uid());previous text;n integer;
begin
 if not activities_private.allowed() then raise exception 'Accès adulte TEST non autorisé'; end if;
 -- Every seat mutation and capacity edit uses this exact activity row lock.
 select * into a from activities_private.activities where id=p_id for update;
 if not found then raise exception 'Activité introuvable'; end if;
 if p_action='leave' then
  if target<>me or a.organizer_id=me then raise exception 'Annulez votre activité en tant qu’organisateur'; end if;
  update activities_private.members set status='left',updated_at=clock_timestamp() where activity_id=p_id and user_id=me and status in ('accepted','pending');
  if found then insert into activities_private.notices(user_id,activity_id,kind) values(a.organizer_id,p_id,'left') on conflict do nothing; end if;
  return;
 end if;
 if not activities_private.visible(p_id) then raise exception 'Activité inaccessible'; end if;
 if p_action in ('cancel','delete') then
  if a.organizer_id<>me then raise exception 'Réservé à l’organisateur'; end if;
  if a.status='deleted' or (a.status='cancelled' and p_action='cancel') then return; end if;
  update activities_private.activities set status=case when p_action='cancel' then 'cancelled' else 'deleted' end,updated_at=clock_timestamp() where id=p_id;
  update activities_private.locations set address='',latitude=null,longitude=null where activity_id=p_id;
  insert into activities_private.notices(user_id,activity_id,kind) select user_id,p_id,p_action from activities_private.members where activity_id=p_id and user_id<>me and status in ('accepted','pending') on conflict do nothing;
  return;
 end if;
 if a.status<>'open' or a.starts_at<=now() then raise exception 'Inscriptions fermées'; end if;
 select status into previous from activities_private.members where activity_id=p_id and user_id=target;
 if p_action='join' then
  if target<>me then raise exception 'Inscription pour soi uniquement'; end if;
  if previous in ('accepted','pending') then return; end if;
  if previous='declined' then raise exception 'Demande refusée par l’organisateur'; end if;
  if (select count(*) from activities_private.members where user_id=me and updated_at>now()-interval '1 hour')>=20 then raise exception 'Trop de demandes récentes'; end if;
 elsif p_action in ('accept','decline') then
  if a.organizer_id<>me or target=me or previous is distinct from 'pending' then raise exception 'Demande non modifiable'; end if;
  if activities_private.blocked(me,target) then raise exception 'Utilisateur bloqué'; end if;
  if not exists(select 1 from activities_private.adult_access where user_id=target and revoked_at is null) then raise exception 'Accès adulte révoqué'; end if;
 else raise exception 'Action inconnue'; end if;
 if p_action='accept' or (p_action='join' and a.join_mode='direct') then
  select count(*) into n from activities_private.members where activity_id=p_id and status='accepted';
  if n>=a.capacity then raise exception 'Activité complète'; end if;
 end if;
 if p_action='join' and a.join_mode='approval' and (select count(*) from activities_private.members where activity_id=p_id and status='pending')>=100 then raise exception 'Liste de demandes complète'; end if;
 insert into activities_private.members(activity_id,user_id,status) values(p_id,target,case when p_action='decline' then 'declined' when p_action='join' and a.join_mode='approval' then 'pending' else 'accepted' end)
 on conflict(activity_id,user_id) do update set status=excluded.status,updated_at=clock_timestamp();
 insert into activities_private.notices(user_id,activity_id,kind) values(case when p_action='join' then a.organizer_id else target end,p_id,p_action) on conflict do nothing;
end $$;
-- Existing moderation queue is reused; no second reports queue.
alter table public.admin_reports drop constraint admin_reports_target_kind_check;
alter table public.admin_reports add constraint admin_reports_target_kind_check check(target_kind in ('event','listing','activity','user'));
create function activities_private.safety(p_id uuid,p_action text,p_user uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();a activities_private.activities%rowtype;
begin
 if not activities_private.allowed() then raise exception 'Accès non autorisé'; end if;
 -- Block locks every affected activity in UUID order before checking membership.
 if p_action='block' then
  perform id from activities_private.activities where organizer_id in (me,p_user) order by id for update;
 end if;
 select * into a from activities_private.activities where id=p_id for update;
 if not activities_private.visible(p_id) then raise exception 'Activité inaccessible'; end if;
 if p_action='report' then
  if length(trim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception 'Motif requis : 10 à 1 000 caractères'; end if;
  if (select count(*) from public.admin_reports where reporter_id=me and created_at>now()-interval '1 hour')>=10 then raise exception 'Trop de signalements récents'; end if;
  if p_user is not null and not exists(select 1 from activities_private.members where activity_id=p_id and user_id=p_user and status='accepted') then raise exception 'Participant introuvable'; end if;
  insert into public.admin_reports(reporter_id,target_kind,target_id,reason) values(me,case when p_user is null then 'activity' else 'user' end,coalesce(p_user,p_id),trim(p_reason)) on conflict do nothing;
 elsif p_action='block' then
  if p_user is null or p_user=me or not exists(select 1 from activities_private.members where activity_id=p_id and user_id=p_user and status='accepted') then raise exception 'Participant invalide'; end if;
  insert into activities_private.blocks(user_id,blocked_id) values(me,p_user) on conflict do nothing;
  update activities_private.members m set status='left',updated_at=clock_timestamp() from activities_private.activities x where x.id=m.activity_id and ((x.organizer_id=p_user and m.user_id=me) or (x.organizer_id=me and m.user_id=p_user));
 else raise exception 'Action inconnue'; end if;
end $$;
-- Public wrappers are SECURITY INVOKER, the narrow definer operations live in a non-exposed schema.
create function public.activities_capabilities() returns jsonb language sql security invoker set search_path='' as $$select activities_private.capabilities()$$;
create function public.activities_list() returns jsonb language sql security invoker set search_path='' as $$select activities_private.list()$$;
create function public.activities_detail(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select activities_private.detail(p_id)$$;
create function public.activities_save(p_id uuid,p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select activities_private.save(p_id,p_data)$$;
create function public.activities_participate(p_id uuid,p_action text,p_user uuid default null) returns void language sql security invoker set search_path='' as $$select activities_private.participate(p_id,p_action,p_user)$$;
create function public.activities_safety(p_id uuid,p_action text,p_user uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select activities_private.safety(p_id,p_action,p_user,p_reason)$$;
revoke all on all functions in schema activities_private from public,anon,authenticated;
grant execute on function activities_private.capabilities(),activities_private.list(),activities_private.detail(uuid),activities_private.save(uuid,jsonb),activities_private.participate(uuid,text,uuid),activities_private.safety(uuid,text,uuid,text) to authenticated;
revoke all on function public.activities_capabilities(),public.activities_list(),public.activities_detail(uuid),public.activities_save(uuid,jsonb),public.activities_participate(uuid,text,uuid),public.activities_safety(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.activities_capabilities(),public.activities_list(),public.activities_detail(uuid),public.activities_save(uuid,jsonb),public.activities_participate(uuid,text,uuid),public.activities_safety(uuid,text,uuid,text) to authenticated;
commit;
