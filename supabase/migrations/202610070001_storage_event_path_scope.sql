-- Prepared after the read-only Production audit; NOT applied remotely.
-- Qualify Storage paths: unqualified name binds to events.name inside EXISTS.
begin;
do $$ begin
  if to_regclass('storage.objects') is null or to_regclass('public.events') is null
     or to_regprocedure('public.event_is_member(uuid,uuid)') is null
     or to_regprocedure('public.event_is_visible(uuid,uuid)') is null then
    raise exception 'Storage event scope prerequisites are missing';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
      and policyname in ('event_cover_visible_v2','event_media_scope_v2',
        'Members can read event voices','Members can upload event voices')) <> 4 then
    raise exception 'Review existing Storage policies before applying this repair';
  end if;
end $$;
alter policy event_cover_visible_v2 on storage.objects using (
  bucket_id='event-media' and exists (
    select 1 from public.events e where e.cover_url=storage.objects.name
      and public.event_is_visible(e.id)
  )
);
alter policy event_media_scope_v2 on storage.objects using (
  bucket_id<>'event-media' or exists (
    select 1 from public.events e where e.id::text=split_part(storage.objects.name,'/',1)
      and (public.event_is_member(e.id)
        or (e.cover_url=storage.objects.name and public.event_is_visible(e.id)))
  )
);
alter policy "Members can read event voices" on storage.objects using (
  bucket_id='event-voices' and exists (
    select 1 from public.events e where e.id::text=split_part(storage.objects.name,'/',1)
      and (public.is_event_member(e.id) or e.creator_id=auth.uid())
  )
);
alter policy "Members can upload event voices" on storage.objects with check (
  bucket_id='event-voices' and exists (
    select 1 from public.events e where e.id::text=split_part(storage.objects.name,'/',1)
      and (public.is_event_member(e.id) or e.creator_id=auth.uid())
  )
);
commit;
