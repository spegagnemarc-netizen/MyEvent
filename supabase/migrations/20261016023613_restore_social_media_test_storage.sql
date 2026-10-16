-- TEST ONLY. Recorded migration restored from Supabase TEST history.
-- Applied exclusively to ahyyknfjsielnqyoxqgh; no automatic migration execution.
do $$ begin if current_database() <> 'postgres' then raise exception 'Unexpected database'; end if; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('social-media','social-media',false,15728640,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
do $$ begin
if exists(select 1 from storage.buckets where id='social-media' and public) then raise exception 'Refuse public social-media bucket';end if;
if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='social_media_select_own') then
create policy social_media_select_own on storage.objects for select to authenticated using(bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
end if;
if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='social_media_insert_own') then
create policy social_media_insert_own on storage.objects for insert to authenticated with check(bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
end if;
if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='social_media_delete_own') then
create policy social_media_delete_own on storage.objects for delete to authenticated using(bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
end if;
end $$;
