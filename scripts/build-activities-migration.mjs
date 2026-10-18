// Generate a fail-closed replay guard from the exact authorised foundation.
// Local PostgreSQL only. Does not connect to Supabase.
import {PGlite} from '@electric-sql/pglite';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const original=execFileSync('git',['show','26334e02127788634ceb2bece8aa5869daf50a95:docs/activities/proposal.sql'],{encoding:'utf8'});
export const catalog=`select jsonb_build_object(
 'schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',coalesce(nspacl,acldefault('n',nspowner))::text) from pg_namespace where nspname='activities_private'),
 'relations',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'options',c.reloptions,'persistence',c.relpersistence,'replica_identity',c.relreplident,'acl',coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))::text) order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='activities_private'),
 'columns',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'number',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'dropped',a.attisdropped,'default',pg_get_expr(d.adbin,d.adrelid),'collation',a.attcollation::regcollation::text,'acl',a.attacl::text) order by c.relname,a.attnum),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='activities_private'),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred,'noinherit',k.connoinherit) order by c.relname,k.conname),'[]') from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='activities_private'),
 'indexes',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready) order by c.relname),'[]') from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='activities_private'),
 'sequences',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'type',s.seqtypid::regtype::text,'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) order by c.relname),'[]') from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='activities_private'),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles::text,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by c.relname,p.polname),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='activities_private'),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled) order by c.relname,t.tgname),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='activities_private' and not t.tgisinternal),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',coalesce(p.proacl,acldefault('f',p.proowner))::text) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='activities_private' or (n.nspname='public' and left(p.proname,11)='activities_')),
 'extra_types',(select coalesce(jsonb_agg(t.typname order by t.typname),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='activities_private' and t.typrelid=0 and t.typelem=0)
) as manifest`;
// Existing public object metadata: only the authorised constraint is excluded.
export const existing=`select md5(coalesce(string_agg(x.line,E'\\n' order by x.line),'')) from (
 select jsonb_build_array('relation',c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions,pg_get_userbyid(c.relowner))::text line from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 union all select jsonb_build_array('column',c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text,pg_get_expr(d.adbin,d.adrelid))::text from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public'
 union all select jsonb_build_array('constraint',c.relname,k.conname,pg_get_constraintdef(k.oid),k.convalidated)::text from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not(c.relname='admin_reports' and k.conname='admin_reports_target_kind_check')
 union all select jsonb_build_array('policy',c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles::text,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))::text from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 union all select jsonb_build_array('function',p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text,pg_get_userbyid(p.proowner))::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,11)<>'activities_' and p.prokind in ('f','p')
) x`;
export const fixture=`create role anon;create role authenticated;create role service_role;
create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.profiles(id uuid primary key,display_name text);create function public.myevent_account_active() returns boolean language sql as $$select true$$;create function public.are_friends(uuid,uuid) returns boolean language sql as $$select false$$;
create table public.admin_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid,target_kind text constraint admin_reports_target_kind_check check(target_kind in ('event','listing')),target_id uuid,reason text,status text default 'open',created_at timestamptz default now());
create unique index reports_one on public.admin_reports(reporter_id,target_kind,target_id) where status='open';
alter default privileges in schema public revoke execute on functions from public;`;
if(process.argv[1]?.endsWith('build-activities-migration.mjs')){
 const db=new PGlite();try{
 await db.exec(fixture);await db.exec(original);
 const expected=(await db.query(catalog)).rows[0].manifest;
 await writeFile('docs/activities/expected-catalog.json',JSON.stringify(expected,null,2)+'\n');
 const install=original.slice(original.indexOf('create schema activities_private;'),original.lastIndexOf('commit;'));
 const initial="CHECK ((target_kind = ANY (ARRAY['event'::text, 'listing'::text])))",final="CHECK ((target_kind = ANY (ARRAY['event'::text, 'listing'::text, 'activity'::text, 'user'::text])))";
 const sql=`-- Authorised TEST foundation; generated by scripts/build-activities-migration.mjs.
-- No functional changes from 26334e0. Sole existing-object change: report target constraint.
-- One atomic DO statement. Exceptions roll back every change. No persistent guard objects.
-- Existing complete conforming installation: read-only no-op. Partial/drifted installation: abort.
DO $guard$
DECLARE expected jsonb := $expected$${JSON.stringify(expected)}$expected$::jsonb;
 actual jsonb; constraint_def text; constraint_valid boolean; before_public text; after_public text; before_reports text; after_reports text; bad_key text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('orevami-activities-v1-install',0));
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installation role mismatch'; END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.are_friends(uuid,uuid)') IS NULL OR to_regprocedure('public.myevent_account_active()') IS NULL THEN RAISE EXCEPTION 'Missing existing dependencies'; END IF;
 SELECT pg_get_constraintdef(oid),convalidated INTO constraint_def,constraint_valid FROM pg_constraint WHERE conrelid='public.admin_reports'::regclass AND conname='admin_reports_target_kind_check' AND contype='c';
 IF NOT coalesce(constraint_valid,false) OR constraint_def NOT IN ($initial$${initial}$initial$,$final$${final}$final$) THEN RAISE EXCEPTION 'Report constraint divergence'; END IF;
 ${catalog.replace(' as manifest','')} INTO actual;
 IF actual->'schema'<>'null'::jsonb OR jsonb_array_length(actual->'functions')>0 THEN
  IF actual IS DISTINCT FROM expected THEN
   SELECT key INTO bad_key FROM jsonb_each(expected) e WHERE actual->e.key IS DISTINCT FROM e.value ORDER BY key LIMIT 1;
   RAISE EXCEPTION 'Existing foundation divergence: %',bad_key;
  END IF;
  IF constraint_def<>$final$${final}$final$ THEN RAISE EXCEPTION 'Incomplete report extension'; END IF;
  RAISE NOTICE 'Conforming foundation: no changes'; RETURN;
 END IF;
 -- No catalog/data write has occurred above this point.
 LOCK TABLE public.admin_reports IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(select 1 from public.admin_reports where target_kind not in ('event','listing','activity','user')) THEN RAISE EXCEPTION 'Incompatible report data'; END IF;
 ${existing} INTO before_public;
 SELECT md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by id),'')) INTO before_reports FROM public.admin_reports r;
 EXECUTE $install$${install}$install$;
 ${catalog.replace(' as manifest','')} INTO actual;
 IF actual IS DISTINCT FROM expected THEN
  SELECT key INTO bad_key FROM jsonb_each(expected) e WHERE actual->e.key IS DISTINCT FROM e.value ORDER BY key LIMIT 1;
  RAISE EXCEPTION 'Installed foundation divergence: %',bad_key;
 END IF;
 ${existing} INTO after_public;
 SELECT md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by id),'')) INTO after_reports FROM public.admin_reports r;
 IF before_public IS DISTINCT FROM after_public OR before_reports IS DISTINCT FROM after_reports THEN RAISE EXCEPTION 'Existing objects or report data changed unexpectedly'; END IF;
 IF (SELECT enabled FROM activities_private.settings WHERE id) IS DISTINCT FROM false OR EXISTS(SELECT 1 FROM activities_private.adult_access) THEN RAISE EXCEPTION 'Activation must remain closed'; END IF;
 RAISE NOTICE 'Foundation installed; activation closed; existing objects and reports preserved';
END $guard$;\n`;
 await writeFile('docs/activities/proposal.sql',sql);
 }finally{await db.close();}
}
