-- MANUAL activation, only on the Supabase TEST project used by the Vercel Preview.
-- Apply AFTER the corrected 003 and the read-only preflight.
-- Never overwrite another pre-request hook; combine it explicitly after review.
begin;
do $$ declare configured text; r record; begin
 if to_regprocedure('public.myevent_api_request_guard()') is null then
  raise exception 'Appliquer 003 corrigée avant 004'; end if;
 if not exists(select 1 from pg_roles where rolname='authenticator') then
  raise exception 'Rôle PostgREST authenticator introuvable'; end if;
 for r in select s.setdatabase,c.value from pg_db_role_setting s
  join pg_roles p on p.oid=s.setrole, lateral unnest(s.setconfig) c(value)
  where p.rolname='authenticator' and c.value like 'pgrst.db_pre_request=%' loop
  configured:=substr(r.value,length('pgrst.db_pre_request=')+1);
  if configured not in ('','public.myevent_api_request_guard') then
   raise exception 'Hook existant % : arrêt, aucune substitution automatique',configured;
  end if;
  if r.setdatabase<>0 then
   raise exception 'Configuration PostgREST par base détectée : contrôler le précontrôle avant activation';
  end if;
 end loop;
end $$;
alter role authenticator set pgrst.db_pre_request='public.myevent_api_request_guard';
notify pgrst,'reload config';
commit;
-- Validate over HTTP with A/B/C: this notification/config cannot be tested by PGlite.
