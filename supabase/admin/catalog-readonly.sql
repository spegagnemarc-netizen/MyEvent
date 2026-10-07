-- Metadata only: no business rows, credentials or changes. Export every result.
begin read only;
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls,
 c.relforcerowsecurity as force_rls,
 jsonb_agg(jsonb_build_object('column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
 'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) as columns
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where n.nspname in ('public','game_private') and c.relkind in ('r','p')
group by n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity order by 1,2;
select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname in ('public','game_private','storage') order by 1,2,3;
select n.nspname,c.relname,con.conname,con.convalidated,pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','game_private','storage') order by 1,2,3;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','game_private','storage') order by 1,2,3;
select n.nspname,p.oid::regprocedure::text as signature,p.prosecdef,p.proconfig,p.proacl,
 pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','game_private') and p.prokind='f' order by 1,2;
select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','game_private','auth') and not t.tgisinternal order by 1,2,3;
select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id;
select pubname,schemaname,tablename from pg_publication_tables order by 1,2,3;
select to_regclass('supabase_migrations.schema_migrations') as migration_registry;
select r.rolname,s.setconfig from pg_db_role_setting s
left join pg_roles r on r.oid=s.setrole
where r.rolname in ('authenticator','anon','authenticated','service_role');
-- Preserve these exact rollback statements BEFORE applying the Storage repair.
-- This SELECT generates text only; it does not execute the ALTER statements.
select policyname,
 format('ALTER POLICY %I ON %I.%I%s%s;',policyname,schemaname,tablename,
  case when qual is not null then ' USING ('||qual||')' else '' end,
  case when with_check is not null then ' WITH CHECK ('||with_check||')' else '' end) as rollback_sql
from pg_policies where schemaname='storage' and tablename='objects'
and policyname in ('event_cover_visible_v2','event_media_scope_v2',
 'Members can read event voices','Members can upload event voices') order by policyname;
rollback;
