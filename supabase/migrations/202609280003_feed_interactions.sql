-- Reactions on the existing event feed and personal camera publications.
begin;
create table public.feed_likes (
 id uuid primary key default gen_random_uuid(),
 event_post_id uuid references public.event_feed_posts(id) on delete cascade,
 camera_post_id uuid references public.social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check ((event_post_id is null) <> (camera_post_id is null)),
 unique(event_post_id,user_id), unique(camera_post_id,user_id)
);
create index feed_likes_camera_idx on public.feed_likes(camera_post_id) where camera_post_id is not null;
create table public.feed_comments (
 id uuid primary key default gen_random_uuid(),
 event_post_id uuid references public.event_feed_posts(id) on delete cascade,
 camera_post_id uuid references public.social_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now(),
 check ((event_post_id is null) <> (camera_post_id is null))
);
create index feed_comments_event_idx on public.feed_comments(event_post_id,created_at) where event_post_id is not null;
create index feed_comments_camera_idx on public.feed_comments(camera_post_id,created_at) where camera_post_id is not null;

-- The camera feed currently has owner-only SELECT: reactions inherit that restriction.
create function public.feed_post_access(p_event uuid,p_camera uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and (
   (p_event is not null and p_camera is null and exists(select 1 from public.event_feed_posts where id=p_event))
   or (p_camera is not null and p_event is null and exists(select 1 from public.social_posts where id=p_camera)))
$$;
revoke all on function public.feed_post_access(uuid,uuid) from public,anon;
grant execute on function public.feed_post_access(uuid,uuid) to authenticated;
alter table public.feed_likes enable row level security;
alter table public.feed_comments enable row level security;
create policy feed_likes_select on public.feed_likes for select to authenticated
 using (public.feed_post_access(event_post_id,camera_post_id));
create policy feed_likes_insert on public.feed_likes for insert to authenticated
 with check (user_id=auth.uid() and public.feed_post_access(event_post_id,camera_post_id));
create policy feed_likes_delete on public.feed_likes for delete to authenticated
 using (user_id=auth.uid() and public.feed_post_access(event_post_id,camera_post_id));
create policy feed_comments_select on public.feed_comments for select to authenticated
 using (public.feed_post_access(event_post_id,camera_post_id));
create policy feed_comments_insert on public.feed_comments for insert to authenticated
 with check (author_id=auth.uid() and public.feed_post_access(event_post_id,camera_post_id));
create policy feed_comments_delete on public.feed_comments for delete to authenticated
 using (author_id=auth.uid() and public.feed_post_access(event_post_id,camera_post_id));
revoke all on public.feed_likes,public.feed_comments from anon,authenticated;
grant select,insert,delete on public.feed_likes,public.feed_comments to authenticated;

-- Return only the reactions to a publication visible under its existing RLS.
create function public.feed_interactions(p_kind text,p_post uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare eid uuid; cid uuid;
begin
 if p_kind='event' then eid:=p_post;
 elsif p_kind='camera' then cid:=p_post;
 else raise exception 'Publication invalide'; end if;
 if auth.uid() is null or not (
   (eid is not null and exists(select 1 from public.event_feed_posts p where p.id=eid
      and (p.event_id is null or public.event_is_visible(p.event_id))))
   or (cid is not null and exists(select 1 from public.social_posts p where p.id=cid and p.user_id=auth.uid()))
 ) then raise exception 'Publication inaccessible'; end if;
 return jsonb_build_object(
   'likes',(select count(*) from public.feed_likes l where l.event_post_id=eid or l.camera_post_id=cid),
   'liked',exists(select 1 from public.feed_likes l where (l.event_post_id=eid or l.camera_post_id=cid) and l.user_id=auth.uid()),
   'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id) from (
     select cm.id,cm.author_id,cm.body,cm.created_at,
       coalesce(nullif(p.display_name,''),p.username,'Membre MyEvent') as author_name,p.avatar as author_avatar
     from public.feed_comments cm left join public.profiles p on p.id=cm.author_id
     where cm.event_post_id=eid or cm.camera_post_id=cid order by cm.created_at desc,cm.id desc limit 50
   ) c),'[]'::jsonb));
end $$;
revoke all on function public.feed_interactions(text,uuid) from public,anon;
grant execute on function public.feed_interactions(text,uuid) to authenticated;
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   foreach t in array array['feed_likes','feed_comments'] loop
     if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
       execute format('alter publication supabase_realtime add table public.%I',t);
     end if;
   end loop;
 end if;
end $$;
commit;
