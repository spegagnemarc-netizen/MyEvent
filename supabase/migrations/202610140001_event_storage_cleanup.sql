-- Prepared only. Apply after 202610130003, with explicit approval.
begin;
create table public.event_storage_cleanup_jobs (
 event_id uuid primary key,
 owner_id uuid not null,
 created_at timestamptz not null default now()
);
alter table public.event_storage_cleanup_jobs enable row level security;
revoke all on public.event_storage_cleanup_jobs from public, anon, authenticated;
grant select on public.event_storage_cleanup_jobs to service_role;

-- Keep a tombstone even after cleanup: reject late uploads and permit retries.
create function public.guard_deleted_event_storage() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id in ('event-media','event-voices') then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.split_part(new.name,'/',1),0));
  if exists(select 1 from public.event_storage_cleanup_jobs j
    where j.event_id::text=pg_catalog.split_part(new.name,'/',1)) then
   raise exception 'Cet événement a été supprimé';
  end if;
 end if;
 return new;
end $$;
create trigger orevami_deleted_event_storage before insert or update of name,bucket_id
 on storage.objects for each row execute function public.guard_deleted_event_storage();
revoke all on function public.guard_deleted_event_storage() from public,anon,authenticated;

create or replace function public.delete_event(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare job_owner uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id::text,0));
 select owner_id into job_owner from public.event_storage_cleanup_jobs where event_id=p_event_id;
 if found then
  if job_owner<>auth.uid() then raise exception 'Suppression non autorisée'; end if;
  return;
 end if;
 perform 1 from public.events where id=p_event_id and creator_id=auth.uid() for update;
 if not found then raise exception 'Suppression non autorisée'; end if;
 -- Never guess ownership for legacy paths outside the event folder.
 if exists(select 1 from public.media where event_id=p_event_id and storage_path is not null
   and storage_path<>'' and pg_catalog.split_part(storage_path,'/',1)<>p_event_id::text)
 or exists(select 1 from public.voice_messages where event_id=p_event_id and storage_path is not null
   and storage_path<>'' and pg_catalog.split_part(storage_path,'/',1)<>p_event_id::text) then
  raise exception 'Un fichier ancien nécessite une vérification avant suppression';
 end if;
 insert into public.event_storage_cleanup_jobs(event_id,owner_id) values(p_event_id,auth.uid());
 -- Reuse owner authorization and existing CASCADE/SET NULL, without changing member guard.
 delete from public.events where id=p_event_id and creator_id=auth.uid();
end $$;
revoke all on function public.delete_event(uuid) from public,anon;
grant execute on function public.delete_event(uuid) to authenticated;

-- Only the server may inspect binary inventories; no client-supplied paths.
create function public.event_storage_cleanup_items(p_event_id uuid,p_owner_id uuid)
returns table(bucket_id text,name text)
language sql security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o
 join public.event_storage_cleanup_jobs j on j.event_id=p_event_id and j.owner_id=p_owner_id
 where o.bucket_id in ('event-media','event-voices')
 and pg_catalog.split_part(o.name,'/',1)=j.event_id::text
 order by o.bucket_id,o.name limit 100;
$$;
create function public.event_storage_cleanup_pending(p_owner_id uuid)
returns table(event_id uuid)
language sql security definer set search_path='' as $$
 select j.event_id from public.event_storage_cleanup_jobs j where j.owner_id=p_owner_id
 and exists(select 1 from storage.objects o where o.bucket_id in ('event-media','event-voices')
  and pg_catalog.split_part(o.name,'/',1)=j.event_id::text)
 order by j.created_at limit 3;
$$;
revoke all on function public.event_storage_cleanup_items(uuid,uuid) from public,anon,authenticated;
revoke all on function public.event_storage_cleanup_pending(uuid) from public,anon,authenticated;
grant execute on function public.event_storage_cleanup_items(uuid,uuid) to service_role;
grant execute on function public.event_storage_cleanup_pending(uuid) to service_role;
commit;
