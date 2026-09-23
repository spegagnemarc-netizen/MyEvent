-- MyEvent social camera feed
-- Run once in the Supabase SQL editor before enabling camera feed publishing.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_path text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  created_at timestamptz not null default now()
);

create index if not exists social_posts_user_created_idx
  on public.social_posts (user_id, created_at desc);

alter table public.social_posts enable row level security;

drop policy if exists "social_posts_select_own" on public.social_posts;
create policy "social_posts_select_own"
  on public.social_posts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "social_posts_insert_own" on public.social_posts;
create policy "social_posts_insert_own"
  on public.social_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "social_posts_delete_own" on public.social_posts;
create policy "social_posts_delete_own"
  on public.social_posts for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media',
  'social-media',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "social_media_select_own" on storage.objects;
create policy "social_media_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "social_media_insert_own" on storage.objects;
create policy "social_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "social_media_delete_own" on storage.objects;
create policy "social_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
