-- READ ONLY on the CURRENT project. Schema metadata only, review locally.
-- Custom Auth triggers are outside a public-schema dump. Never copy Auth data.
select pg_get_triggerdef(t.oid)||';' as test_sql
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='auth' and c.relname='users' and not t.tgisinternal
 and t.tgfoid in (select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public');
-- Realtime publication membership is configuration, not personal data.
select format('alter publication supabase_realtime add table %I.%I;',schemaname,tablename) as test_sql
from pg_publication_tables where pubname='supabase_realtime' and schemaname in ('public','game_private') order by schemaname,tablename;
-- Save/check default privileges too; do not export existing platform_admins rows.
select defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl from pg_default_acl;
