-- PROPOSITION UNIQUEMENT. Production : autorisation spécifique requise.
-- Ne supprime aucun événement. Conserve le contrôle propriétaire de delete_event,
-- les RLS et la reprise du nettoyage Storage. Pas de nouveau SECURITY DEFINER.
begin;
create or replace function public.event_admin_guard() returns trigger
language plpgsql set search_path='' as $$
declare target_id uuid;
begin
 if tg_op='UPDATE' then
  if tg_table_name='event_outing_plan_items' and new.plan_id is distinct from old.plan_id
   or tg_table_name='poll_options' and new.poll_id is distinct from old.poll_id then
   raise exception 'Le parent ne peut pas être modifié';
  end if;
  if tg_table_name not in ('event_outing_plan_items','poll_options') and new.event_id is distinct from old.event_id then
   raise exception 'L’événement ne peut pas être modifié';
  end if;
 end if;
 if tg_table_name='event_outing_plan_items' then
  select p.event_id into target_id from public.event_outing_plans p where p.id=coalesce(new.plan_id,old.plan_id);
 elsif tg_table_name='poll_options' then
  select p.event_id into target_id from public.polls p where p.id=coalesce(new.poll_id,old.poll_id);
 else
  target_id=coalesce(new.event_id,old.event_id);
 end if;
 -- During the authorized parent CASCADE the event row no longer exists.
 -- Only the existing delete_event definer, at nested trigger depth, with its
 -- durable owner-bound cleanup job may complete that cascade.
 if tg_op='DELETE' and target_id is not null and pg_catalog.pg_trigger_depth()>1
  and current_user=pg_catalog.pg_get_userbyid((select proowner from pg_catalog.pg_proc where oid='public.delete_event(uuid)'::regprocedure)) then
  if not exists(select 1 from public.events e where e.id=target_id)
   and exists(select 1 from public.event_storage_cleanup_jobs j where j.event_id=target_id and j.owner_id=auth.uid()) then
   return old;
  end if;
 end if;
 if target_id is not null and not public.event_is_manager(target_id) then
  raise exception 'Gestion réservée au créateur ou aux co-organisateurs';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
commit;
