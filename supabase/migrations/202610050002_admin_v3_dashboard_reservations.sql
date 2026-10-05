-- Admin V3 lot 1: dashboard, user details and reservation supervision.
-- Additive only. Do not apply remotely without a separate authorization and preflight.
begin;

-- Extend the overview without exposing auth.users to the browser.
create or replace function public.myevent_admin_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_personal bigint := 0; v_event_res bigint := 0;
begin
 perform public.myevent_admin_guard();
 if to_regclass('public.personal_reservations') is not null then
  execute 'select count(*) filter (where event_id is null), count(*) filter (where event_id is not null) from public.personal_reservations'
   into v_personal,v_event_res;
 end if;
 return jsonb_build_object(
  'users',(select count(*) from auth.users),
  'new_users_24h',(select count(*) from auth.users where created_at>=now()-interval '24 hours'),
  'new_users_7d',(select count(*) from auth.users where created_at>=now()-interval '7 days'),
  'new_users_30d',(select count(*) from auth.users where created_at>=now()-interval '30 days'),
  'events',(select count(*) from public.events),
  'marketplace',(select count(*) from public.marketplace_listings),
  'personal_reservations',v_personal,
  'event_reservations',v_event_res,
  'suspended',(select count(*) from public.admin_account_controls where suspended),
  'suspension_gate_ready',public.myevent_suspension_gate_ready(),
  'open_reports',(select count(*) from public.admin_reports where status='open'),
  'recent_admin_actions',(select count(*) from public.admin_audit_log where created_at>=now()-interval '24 hours'),
  'generated_at',now());
end $$;
revoke all on function public.myevent_admin_overview() from public,anon;
grant execute on function public.myevent_admin_overview() to authenticated;

-- One controlled user detail endpoint. No email, provider metadata or auth secrets.
create or replace function public.myevent_admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.myevent_admin_guard();
 if p_user is null then raise exception 'Utilisateur invalide' using errcode='22023'; end if;
 select jsonb_build_object(
  'id',u.id,'display_name',p.display_name,'username',p.username,'avatar',p.avatar,
  'created_at',u.created_at,
  'suspended',(coalesce(c.suspended,false) or coalesce(u.banned_until>now(),false)),
  'managed_suspension',coalesce(c.suspended,false),
  'is_admin',exists(select 1 from public.platform_admins a where a.user_id=u.id),
  'events_created',(select count(*) from public.events e where e.creator_id=u.id),
  'last_admin_action',(select max(l.created_at) from public.admin_audit_log l where l.target_kind='user' and l.target_id=u.id)
 ) into result
 from auth.users u left join public.profiles p on p.id=u.id
 left join public.admin_account_controls c on c.user_id=u.id
 where u.id=p_user;
 if result is null then raise exception 'Compte introuvable' using errcode='P0002'; end if;
 return result;
end $$;
revoke all on function public.myevent_admin_user_detail(uuid) from public,anon;
grant execute on function public.myevent_admin_user_detail(uuid) to authenticated;

-- Reservation list is deliberately metadata-only: proof/base64 is never returned.
create or replace function public.myevent_admin_reservations(p_scope text default 'all',p_query text default '',p_limit int default 60)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb := '[]'::jsonb; q text:=left(trim(coalesce(p_query,'')),100);
 n int:=least(greatest(coalesce(p_limit,60),1),100);
begin
 perform public.myevent_admin_guard();
 if p_scope not in ('all','personal','event') then raise exception 'Filtre invalide' using errcode='22023'; end if;
 if to_regclass('public.personal_reservations') is null then return result; end if;
 execute $q$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
   select r.id,r.owner_id,r.event_id,r.kind,r.created_at,r.updated_at,
    p.display_name as owner_name,e.name as event_name,
    left(coalesce(r.details->>'provider',r.details->>'supplier',''),120) as provider,
    left(coalesce(r.details->>'destination',r.details->>'place_name',r.details->>'title',''),160) as destination,
    left(coalesce(r.details->>'reservation_status','added'),40) as reservation_status,
    (r.details ? 'proof' and r.details->'proof' is not null and r.details->'proof'<>'null'::jsonb) as has_proof
   from public.personal_reservations r
   left join public.profiles p on p.id=r.owner_id
   left join public.events e on e.id=r.event_id
   where ($1='all' or ($1='personal' and r.event_id is null) or ($1='event' and r.event_id is not null))
    and ($2='' or coalesce(p.display_name,'') ilike '%'||$2||'%' or coalesce(e.name,'') ilike '%'||$2||'%'
      or coalesce(r.details->>'destination','') ilike '%'||$2||'%' or r.id::text=$2)
   order by r.created_at desc limit $3
  ) x
 $q$ into result using p_scope,q,n;
 return result;
end $$;
revoke all on function public.myevent_admin_reservations(text,text,int) from public,anon;
grant execute on function public.myevent_admin_reservations(text,text,int) to authenticated;


-- Reconcile the registry without assuming PostgreSQL's historical CHECK constraint name.
do $ declare r record; begin
 for r in
  select c.conname from pg_constraint c
  join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='admin_partner_registry' and c.contype='c'
   and pg_get_constraintdef(c.oid) ilike '%provider%'
 loop
  execute format('alter table public.admin_partner_registry drop constraint %I',r.conname);
 end loop;
end $;
alter table public.admin_partner_registry add constraint admin_partner_registry_provider_check
 check (provider in ('getyourguide','viator','booking','ticketnetwork','fnac_spectacles',
 'hotels_com','expedia','abritel','omio','tiqets','awin'));
insert into public.admin_partner_registry(provider,label,enabled,notes) values
 ('hotels_com','Hotels.com',true,'Widget affilié'),
 ('expedia','Expedia',true,'Séjours et vols'),
 ('abritel','Abritel',true,'Hébergements'),
 ('omio','Omio',true,'Transport'),
 ('ticketnetwork','TicketNetwork',true,'Billetterie'),
 ('viator','Viator',true,'Activités'),
 ('tiqets','Tiqets',false,'Demande partenaire en attente'),
 ('awin','Awin',false,'Réseau partenaire; programmes à valider individuellement'),
 ('booking','Booking.com',false,'API/partenariat en attente; ne pas confondre avec les widgets Expedia Group'),
 ('getyourguide','GetYourGuide',false,'Intégration non active à ce stade'),
 ('fnac_spectacles','Fnac Spectacles',false,'Programme/accès non confirmé comme actif')
on conflict(provider) do update set label=excluded.label,notes=excluded.notes,updated_at=now();

-- Extend the legacy affiliate-content catalogue to the providers currently managed by MyEvent.
do $ declare r record; begin
 for r in
  select c.conname from pg_constraint c
  join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='admin_partner_content' and c.contype='c'
   and pg_get_constraintdef(c.oid) ilike '%provider%'
 loop execute format('alter table public.admin_partner_content drop constraint %I',r.conname); end loop;
end $;
alter table public.admin_partner_content add constraint admin_partner_content_provider_check
 check (provider in ('getyourguide','viator','booking','ticketnetwork','fnac_spectacles',
 'hotels_com','expedia','abritel','omio','tiqets','awin'));

create or replace function public.myevent_admin_partner_content_save(
 p_provider text,p_kind text,p_title text,p_city text default '',p_external_id text default '',
 p_affiliate_url text default '',p_campaign text default '',p_enabled boolean default false,p_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $
declare v_id uuid;
begin
 perform public.myevent_admin_guard();
 if not exists(select 1 from public.admin_partner_registry where provider=p_provider)
 or p_kind not in ('city_widget','activity','availability')
 or length(trim(coalesce(p_title,''))) not between 1 and 160
 or length(coalesce(p_city,''))>120 or length(coalesce(p_external_id,''))>100
 or length(coalesce(p_campaign,''))>100 or length(coalesce(p_affiliate_url,''))>2048
 or (coalesce(p_affiliate_url,'')<>'' and p_affiliate_url !~ '^https://')
 then raise exception 'Contenu invalide' using errcode='22023'; end if;
 if p_id is null then
  insert into public.admin_partner_content(provider,kind,title,city,external_id,affiliate_url,campaign,enabled)
  values(p_provider,p_kind,trim(p_title),coalesce(p_city,''),coalesce(p_external_id,''),coalesce(p_affiliate_url,''),coalesce(p_campaign,''),coalesce(p_enabled,false))
  returning id into v_id;
 else
  update public.admin_partner_content set provider=p_provider,kind=p_kind,title=trim(p_title),city=coalesce(p_city,''),
   external_id=coalesce(p_external_id,''),affiliate_url=coalesce(p_affiliate_url,''),campaign=coalesce(p_campaign,''),
   enabled=coalesce(p_enabled,false),updated_at=now() where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Contenu introuvable' using errcode='P0002'; end if;
 end if;
 return v_id;
end $;
revoke all on function public.myevent_admin_partner_content_save(text,text,text,text,text,text,text,boolean,uuid) from public,anon;
grant execute on function public.myevent_admin_partner_content_save(text,text,text,text,text,text,text,boolean,uuid) to authenticated;

create or replace function public.myevent_admin_statistics()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare personal_total bigint:=0; personal_30d bigint:=0; linked_total bigint:=0;
begin
 perform public.myevent_admin_guard();
 if to_regclass('public.personal_reservations') is not null then
  execute 'select count(*),count(*) filter(where created_at>=now()-interval ''30 days''),count(*) filter(where event_id is not null) from public.personal_reservations'
   into personal_total,personal_30d,linked_total;
 end if;
 return jsonb_build_object(
  'users_total',(select count(*) from auth.users),
  'users_30d',(select count(*) from auth.users where created_at>=now()-interval '30 days'),
  'events_total',(select count(*) from public.events),
  'events_30d',(select count(*) from public.events where created_at>=now()-interval '30 days'),
  'marketplace_total',(select count(*) from public.marketplace_listings),
  'reservations_total',personal_total,
  'reservations_30d',personal_30d,
  'reservations_linked_to_event',linked_total,
  'reports_open',(select count(*) from public.admin_reports where status='open'),
  'reports_resolved',(select count(*) from public.admin_reports where status='resolved'),
  'partners_enabled',(select count(*) from public.admin_partner_registry where enabled),
  'generated_at',now());
end $$;
revoke all on function public.myevent_admin_statistics() from public,anon;
grant execute on function public.myevent_admin_statistics() to authenticated;


-- Owner/Super Admin readiness helpers. Membership is never hardcoded in client code.
create or replace function public.myevent_admin_identity()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=auth.uid(); v_role text;
begin
 if v_id is null then raise exception 'Authentification requise' using errcode='42501'; end if;
 select role into v_role from public.platform_admins where user_id=v_id;
 return jsonb_build_object(
  'user_id',v_id,
  'is_admin',v_role='super_admin',
  'role',v_role,
  'account_active',public.myevent_account_active()
 );
end $$;
revoke all on function public.myevent_admin_identity() from public,anon;
grant execute on function public.myevent_admin_identity() to authenticated;

-- Deliberately SQL-only: production owner enrollment remains a separate, explicit operation.
-- Example to execute only after final production authorization:
-- insert into public.platform_admins(user_id,role)
-- values ('OWNER_AUTH_UUID'::uuid,'super_admin')
-- on conflict(user_id) do update set role=excluded.role;

commit;
