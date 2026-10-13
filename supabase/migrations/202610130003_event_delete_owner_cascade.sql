-- Prepared correction: apply only after approval and verification on the restored local database.
-- Existing event_member_guard is kept: a parent deletion causes its CASCADE
-- to see no parent, while a standalone owner leave continues to be rejected.
begin;
create or replace function public.delete_event(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 -- Lock and authorize the actual parent before any dependent deletion.
 perform 1 from public.events where id=p_event_id and creator_id=auth.uid() for update;
 if not found then raise exception 'Vous n''êtes pas autorisé à supprimer cet événement'; end if;
 -- All event dependencies were inspected: CASCADE or SET NULL.
 -- Storage binary cleanup is separate; never delete Storage metadata directly.
 delete from public.events where id=p_event_id and creator_id=auth.uid();
end $$;
commit;
