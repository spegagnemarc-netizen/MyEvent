-- READ ONLY: run on the Supabase TEST project used by the Vercel Preview.
-- Save ALL result grids before applying 003/004. No user data/secrets are returned.
select current_database() as database_name,current_user as sql_role;
select n.nspname as schema_name,c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'SELECT') as client_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p') order by 1,2;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by 1,2,3;
select table_schema,table_name,column_name,data_type,udt_name
from information_schema.columns where (table_schema='auth' and table_name='users'
 and column_name in ('id','created_at','banned_until')) or (table_schema='public'
 and table_name in ('profiles','events','marketplace_listings','platform_admins','admin_partner_content'))
order by table_schema,table_name,ordinal_position;
select p.oid::regprocedure as function_name,p.prosecdef as security_definer,
 pg_get_userbyid(p.proowner) as owner,p.proconfig,p.proacl,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as client_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','game_private') order by 1;
select p.oid::regprocedure as function_name,pg_get_functiondef(p.oid) as original_definition
from pg_proc p where p.oid in ('public.myevent_admin_overview()'::regprocedure,
 'public.event_protect_identity()'::regprocedure,'public.event_is_visible(uuid,uuid)'::regprocedure);
select r.rolname,s.setdatabase,s.setconfig
from pg_db_role_setting s join pg_roles r on r.oid=s.setrole where r.rolname='authenticator';
select t.tgname,t.tgrelid::regclass as table_name,t.tgfoid::regprocedure as trigger_function
from pg_trigger t where not t.tgisinternal order by 2,1;
select has_column_privilege(current_user,'auth.users','banned_until','UPDATE') as auth_ban_update_allowed;
