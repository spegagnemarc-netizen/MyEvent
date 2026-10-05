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
  execute 'select count(*), count(*) filter (where event_id is not null) from public.personal_reservations'
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

commit;
