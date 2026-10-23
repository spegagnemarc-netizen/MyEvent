-- V1.5 proposed delta: NO remote application authorised yet.
-- No table, RPC, existing constraint, RLS policy or grant is removed or added.
-- Four columns and three new CHECK constraints; four private implementations updated.
alter table activities_private.settings add column registrations_enabled boolean not null default false;
alter table activities_private.activities add column activity_type text, add column venue_cost_status text not null default 'unknown', add column cost_details text not null default '';
alter table activities_private.activities add constraint activities_type_v15_check check(activity_type is null or ((category='restaurant' and activity_type in ('restaurant','cafe')) or (category='randonnee' and activity_type in ('randonnee','promenade')) or (category='cinema' and activity_type in ('cinema')) or (category='bowling' and activity_type in ('bowling')) or (category='sport' and activity_type in ('ski','snowboard','piscine','patinoire','karting','escalade','laser_game','paintball','tennis','football','velo','accrobranche')) or (category='jeux' and activity_type in ('jeux_societe','escape_game','billard','flechettes','jeux_video')) or (category='culture' and activity_type in ('concert','spectacle','musee','exposition','theatre','visite_touristique','atelier_creatif')) or (category='famille' and activity_type in ('parc','aire_jeux','zoo','ferme_pedagogique','activites_familiales')) or (category='autres' and activity_type in ('karaoke','parc_attractions','aperitif','pique_nique','barbecue','soiree_amis','autres')))), add constraint activities_venue_cost_v15_check check(venue_cost_status in ('free','unknown','on_site')), add constraint activities_cost_details_v15_check check(length(cost_details)<=1200);
CREATE OR REPLACE FUNCTION activities_private.capabilities()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('enabled',coalesce((select enabled from activities_private.settings),false),'adult_access',auth.uid() is not null and public.myevent_account_active() and exists(select 1 from activities_private.adult_access where user_id=auth.uid() and revoked_at is null),'registrations_enabled',coalesce((select registrations_enabled from activities_private.settings),false),'version',2)
$function$
;
CREATE OR REPLACE FUNCTION activities_private.detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a activities_private.activities%rowtype; me uuid:=auth.uid(); accepted boolean; owner boolean; result jsonb;
begin
 if not activities_private.visible(p_id) then return null; end if;
 select * into a from activities_private.activities where id=p_id;
 owner:=a.organizer_id=me;
 accepted:=owner or exists(select 1 from activities_private.members where activity_id=p_id and user_id=me and status='accepted');
 select to_jsonb(a)-'created_at'-'updated_at' || jsonb_build_object(
  'organizer_name',(select display_name from public.profiles where id=a.organizer_id),'is_owner',owner,'membership',(select status from activities_private.members where activity_id=p_id and user_id=me),
  'participants_count',(select count(*) from activities_private.members where activity_id=p_id and status='accepted'),
  'remaining',greatest(0,a.capacity-(select count(*) from activities_private.members where activity_id=p_id and status='accepted')),
  'address',case when accepted then l.address else null end,
  'position',case when l.latitude is null then null else case when accepted then jsonb_build_object('lat',l.latitude,'lon',l.longitude) else jsonb_build_object('lat',round(l.latitude::numeric,2),'lon',round(l.longitude::numeric,2)) end end,
  'members',case when accepted then coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'status',m.status,'display_name',coalesce(p.display_name,'Participant'))) from activities_private.members m left join public.profiles p on p.id=m.user_id where m.activity_id=p_id and (m.status='accepted' or (owner and m.status='pending')) and not activities_private.blocked(me,m.user_id)),'[]'::jsonb) else '[]'::jsonb end)
 into result from activities_private.locations l where l.activity_id=p_id;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION activities_private.participate(p_id uuid, p_action text, p_user uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid();a activities_private.activities%rowtype;target uuid:=coalesce(p_user,auth.uid());previous text;n integer;
begin
 if not activities_private.allowed() then raise exception 'Accès adulte TEST non autorisé'; end if;
 if p_action in ('join','accept') and not coalesce((select registrations_enabled from activities_private.settings),false) then raise exception 'Inscriptions fermées sur TEST'; end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION activities_private.save(p_id uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 insert into activities_private.activities(id,organizer_id,title,description,category,starts_at,city,venue,capacity,visibility,join_mode,cost_mode,cost_amount,conditions,activity_type,venue_cost_status,cost_details)
 values(id,me,trim(p_data->>'title'),trim(p_data->>'description'),p_data->>'category',(p_data->>'starts_at')::timestamptz,trim(p_data->>'city'),coalesce(p_data->>'venue',''),(p_data->>'capacity')::integer,p_data->>'visibility',p_data->>'join_mode',p_data->>'cost_mode',case when p_data->>'cost_mode'='on_site' then (p_data->>'cost_amount')::numeric else null end,coalesce(p_data->>'conditions',''),nullif(p_data->>'activity_type',''),coalesce(p_data->>'venue_cost_status','unknown'),coalesce(p_data->>'cost_details',''))
 on conflict on constraint activities_pkey do update set title=excluded.title,description=excluded.description,category=excluded.category,starts_at=excluded.starts_at,city=excluded.city,venue=excluded.venue,capacity=excluded.capacity,visibility=excluded.visibility,join_mode=excluded.join_mode,cost_mode=excluded.cost_mode,cost_amount=excluded.cost_amount,conditions=excluded.conditions,activity_type=excluded.activity_type,venue_cost_status=excluded.venue_cost_status,cost_details=excluded.cost_details,updated_at=clock_timestamp();
 insert into activities_private.locations(activity_id,address,latitude,longitude) values(id,coalesce(p_data->>'address',''),(p_data->>'latitude')::double precision,(p_data->>'longitude')::double precision)
 on conflict(activity_id) do update set address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude;
 if p_id is null then insert into activities_private.members values(id,me,'accepted',now());
 else insert into activities_private.notices(user_id,activity_id,kind) select user_id,id,'updated' from activities_private.members where activity_id=id and user_id<>me and status in ('accepted','pending') on conflict do nothing;
 end if;
 return id;
end $function$
;
