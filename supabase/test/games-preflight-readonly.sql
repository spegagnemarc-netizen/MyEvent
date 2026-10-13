-- READ ONLY. Run only in MyEvent-Admin-Test / ahyyknfjsielnqyoxqgh.
-- No migration, data update, credential lookup or permission change.

with required(name) as (values
 ('game_create'),('game_join'),('game_snapshot'),('game_action'),
 ('game_my_rooms'),('game_contacts'),('game_is_member'),
 ('defis_create'),('defis_join'),('defis_snapshot'),('defis_action'),
 ('defis_my_rooms'),('defis_contacts'),('are_friends'))
select required.name, p.oid is not null as exists_in_catalog,
 pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef as security_definer, p.provolatile as volatility,
 case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end as authenticated_execute,
 case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end as anon_execute
from required
left join pg_namespace n on n.nspname='public'
left join pg_proc p on p.pronamespace=n.oid and p.proname=required.name
order by required.name,arguments;

with required(schema_name,table_name) as (values
 ('public','profiles'),('public','events'),('public','event_members'),
 ('public','friendships'),('public','game_rooms'),('public','game_players'),
 ('public','game_invitations'),('public','game_rounds'),('public','game_scores'),
 ('public','game_challenges'),('game_private','secrets'),
 ('game_private','word_pairs'),('game_private','defis_catalog'))
select r.schema_name,r.table_name,c.oid is not null as exists_in_catalog,
 c.relrowsecurity as rls_enabled,c.relforcerowsecurity as force_rls
from required r
left join pg_namespace n on n.nspname=r.schema_name
left join pg_class c on c.relnamespace=n.oid and c.relname=r.table_name and c.relkind in ('r','p')
order by r.schema_name,r.table_name;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename like 'game_%'
order by tablename,policyname;

select rolname,has_schema_privilege(rolname,'public','USAGE') as public_usage
from pg_roles where rolname in ('anon','authenticated','service_role');
