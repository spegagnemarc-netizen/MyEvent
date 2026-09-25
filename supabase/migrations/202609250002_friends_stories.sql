-- Friends and private 24-hour stories. Apply after the existing social feed migration.
create table public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requester uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low,user_high),
  check (user_low < user_high),
  check (requester in (user_low,user_high))
);
create index friendships_high_idx on public.friendships(user_high);
alter table public.friendships enable row level security;
create policy friendships_read on public.friendships for select to authenticated
  using (auth.uid() in (user_low,user_high));
-- Mutations go through the locked-down RPC, never direct table writes.
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create or replace function public.friend_action(other_id uuid, action text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); lo uuid; hi uuid; rel public.friendships%rowtype;
begin
  if me is null or other_id is null or me = other_id then raise exception 'Relation invalide'; end if;
  lo := least(me,other_id); hi := greatest(me,other_id);
  perform pg_advisory_xact_lock(hashtextextended(lo::text || hi::text, 0));
  select * into rel from public.friendships where user_low=lo and user_high=hi;
  if action = 'send' then
    if found then raise exception 'Demande déjà existante'; end if;
    insert into public.friendships(user_low,user_high,requester,status) values(lo,hi,me,'pending');
  elsif action = 'accept' then
    if not found or rel.status <> 'pending' or rel.requester = me then raise exception 'Demande introuvable'; end if;
    update public.friendships set status='accepted',updated_at=now() where user_low=lo and user_high=hi;
  elsif action = 'decline' then
    if not found or rel.status <> 'pending' or rel.requester = me then raise exception 'Demande introuvable'; end if;
    delete from public.friendships where user_low=lo and user_high=hi;
  elsif action = 'cancel' then
    if not found or rel.status <> 'pending' or rel.requester <> me then raise exception 'Demande introuvable'; end if;
    delete from public.friendships where user_low=lo and user_high=hi;
  elsif action = 'remove' then
    if not found or rel.status <> 'accepted' then raise exception 'Amitié introuvable'; end if;
    delete from public.friendships where user_low=lo and user_high=hi;
  else raise exception 'Action inconnue'; end if;
end $$;
revoke all on function public.friend_action(uuid,text) from public;
grant execute on function public.friend_action(uuid,text) to authenticated;

-- Only the four public-facing fields leave the profile table; existing profile RLS is unchanged.
create or replace function public.social_profile_search(term text)
returns table(id uuid,display_name text,username text,avatar text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or length(trim(coalesce(term,''))) < 2 then return; end if;
  return query select p.id,p.display_name::text,p.username::text,p.avatar::text
    from public.profiles p where p.id <> auth.uid()
      and (p.display_name ilike '%' || trim(term) || '%' or p.username ilike '%' || trim(term) || '%')
    order by p.display_name limit 20;
end $$;
revoke all on function public.social_profile_search(text) from public;
grant execute on function public.social_profile_search(text) to authenticated;

create or replace function public.social_friend_profiles(ids uuid[])
returns table(id uuid,display_name text,username text,avatar text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.display_name::text,p.username::text,p.avatar::text from public.profiles p
  where p.id=any(ids) and (p.id=auth.uid() or exists (
    select 1 from public.friendships f where f.user_low=least(p.id,auth.uid())
    and f.user_high=greatest(p.id,auth.uid()))) limit 101
$$;
revoke all on function public.social_friend_profiles(uuid[]) from public;
grant execute on function public.social_friend_profiles(uuid[]) to authenticated;

create table public.social_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  media_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  caption text not null default '' check (char_length(caption)<=500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (media_path like author_id::text || '/%')
);
create index social_stories_author_expiry_idx on public.social_stories(author_id,expires_at);
alter table public.social_stories enable row level security;
create or replace function public.are_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friendships where user_low=least(a,b) and user_high=greatest(a,b) and status='accepted')
$$;
revoke all on function public.are_friends(uuid,uuid) from public;
grant execute on function public.are_friends(uuid,uuid) to authenticated;
create policy stories_read on public.social_stories for select to authenticated
  using (expires_at > now() and (author_id=auth.uid() or public.are_friends(auth.uid(),author_id)));
create policy stories_insert on public.social_stories for insert to authenticated
  with check (author_id=auth.uid() and created_at > now()-interval '1 minute' and created_at <= now()+interval '1 minute'
    and expires_at > now() and expires_at <= now()+interval '24 hours');
create policy stories_delete on public.social_stories for delete to authenticated using (author_id=auth.uid());
grant select,insert,delete on public.social_stories to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('story-media','story-media',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy story_media_upload on storage.objects for insert to authenticated
  with check (bucket_id='story-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy story_media_read on storage.objects for select to authenticated
  using (bucket_id='story-media' and (
    (storage.foldername(name))[1]=auth.uid()::text or exists (
      select 1 from public.social_stories s where s.media_path=name and s.expires_at>now()
        and public.are_friends(auth.uid(),s.author_id))));
create policy story_media_delete on storage.objects for delete to authenticated
  using (bucket_id='story-media' and (storage.foldername(name))[1]=auth.uid()::text);
