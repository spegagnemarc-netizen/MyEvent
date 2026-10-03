-- TARGETED rollback for 003/004, TEST project only, after saving audit data.
-- Stops admin mutations, restores original functions and policies, keeps admin tables/audit.
-- Never enables suspended users by accident: abort while managed suspensions exist.
begin;
do $$ begin
 if exists(select 1 from public.admin_account_controls where suspended) then
  raise exception 'Réactiver les suspensions MyEvent et vérifier les bannissements Auth avant ce retour arrière';
 end if;
end $$;
revoke execute on function public.myevent_admin_action(text,uuid,text,text,text),
 public.myevent_admin_config(text,text,boolean,text),public.myevent_admin_list(text,text,int),
 public.myevent_report(text,uuid,text) from authenticated;
do $$ declare r record; v text; begin
 -- Only reset OUR hook; a later unrelated hook must not be erased.
 select c.value into v from pg_db_role_setting s join pg_roles p on p.oid=s.setrole,
  lateral unnest(s.setconfig) c(value)
  where p.rolname='authenticator' and s.setdatabase=0 and c.value like 'pgrst.db_pre_request=%';
 if v='pgrst.db_pre_request=public.myevent_api_request_guard' then
  alter role authenticator reset pgrst.db_pre_request;
 end if;
 for r in select schemaname,tablename,policyname from pg_policies
  where policyname in ('admin_account_active_v2','admin_listing_visibility_v2','admin_listing_publish_v2') loop
  execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
 for r in select definition from public.admin_v2_install_snapshot loop execute r.definition; end loop;
end $$;
drop trigger if exists myevent_admin_content_audit_v2 on public.admin_partner_content;
notify pgrst,'reload config';
commit;
-- This does NOT undo visibility/moderation actions individually or destroy audit history.
-- Do not re-run 003 after rollback: restore the test backup or prepare a recovery migration.
