-- READ ONLY — Production readiness preflight for Explorer + Admin V3.
-- This file must not mutate data or schema. Save all result grids before any migration.
select current_database() as database_name,current_user as sql_role,now() as checked_at;

select x.object_name,to_regclass(x.object_name) is not null as present
from (values
 ('public.platform_admins'),('public.admin_partner_content'),('public.admin_account_controls'),
 ('public.admin_audit_log'),('public.admin_partner_registry'),('public.admin_app_settings'),
 ('public.personal_reservations'),('public.events'),('public.marketplace_listings'),('public.profiles')
) x(object_name) order by 1;

select p.oid::regprocedure::text as function_name,p.prosecdef as security_definer,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'myevent_is_admin','myevent_admin_guard','myevent_admin_overview','myevent_admin_list',
 'myevent_admin_action','myevent_admin_config','myevent_admin_statistics',
 'myevent_admin_reservations','myevent_admin_user_detail','myevent_admin_identity',
 'myevent_suspension_gate_ready'
) order by 1;

select table_schema,table_name,column_name,data_type
from information_schema.columns
where (table_schema='auth' and table_name='users' and column_name in ('id','created_at','banned_until'))
 or (table_schema='public' and table_name='personal_reservations'
  and column_name in ('id','owner_id','event_id','kind','details','created_at','updated_at'))
order by table_schema,table_name,ordinal_position;

select schemaname,tablename,policyname,roles,cmd
from pg_policies
where schemaname='public' and tablename in (
 'platform_admins','admin_account_controls','admin_audit_log','admin_partner_registry',
 'admin_app_settings','personal_reservations')
order by tablename,policyname;

select provider,label,enabled
from public.admin_partner_registry
where to_regclass('public.admin_partner_registry') is not null
order by provider;

-- Owner enrollment status: run only after replacing the placeholder locally.
-- Do NOT commit a real owner UUID to this file.
-- select exists(select 1 from public.platform_admins where user_id='OWNER_AUTH_UUID'::uuid) as owner_is_admin;
