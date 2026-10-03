-- READ ONLY on the CURRENT project, after approval to inspect its metadata.
-- Produces SQL for review, NOT execution on the current project.
-- No files, object rows, Auth users or personal data are exported.
select format('insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(%L,%L,%L,%L,%L::text[]) on conflict(id) do nothing;',
 id,name,public,file_size_limit,allowed_mime_types::text) as test_sql
from storage.buckets where id in ('profile-avatars','event-media','social-media','story-media','marketplace-images','dm-media','event-voices') order by id;
select format('create policy %I on storage.objects as %s for %s to %s%s%s;',
 policyname,permissive,cmd,(select string_agg(quote_ident(r),',') from unnest(roles) r),
 case when qual is null then '' else format(' using (%s)',qual) end,
 case when with_check is null then '' else format(' with check (%s)',with_check) end) as test_sql
from pg_policies where schemaname='storage' and tablename='objects'
 and policyname<>'admin_account_active_v2' order by policyname;
-- Review output locally; DO NOT copy policies with hardcoded user UUIDs/secrets.
-- Restore only custom storage policies/bucket CONFIG on a fresh TEST project.
