-- Likes on private, unexpired Stories. Replies use the existing private DM RPCs.
begin;
create table public.social_story_likes (
 story_id uuid not null references public.social_stories(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(story_id,user_id)
);
create index social_story_likes_user_idx on public.social_story_likes(user_id);
alter table public.social_story_likes enable row level security;
create policy story_likes_read on public.social_story_likes for select to authenticated
 using ((user_id=auth.uid() or exists (
   select 1 from public.social_stories s where s.id=story_id and s.author_id=auth.uid()))
   and exists(select 1 from public.social_stories s where s.id=story_id));
create policy story_likes_insert on public.social_story_likes for insert to authenticated
 with check (user_id=auth.uid() and exists(select 1 from public.social_stories s where s.id=story_id));
create policy story_likes_delete on public.social_story_likes for delete to authenticated
 using (user_id=auth.uid());
revoke all on public.social_story_likes from anon,authenticated;
grant select,insert,delete on public.social_story_likes to authenticated;

-- RLS hides other people's liker identities; this RPC exposes only an aggregate.
create function public.story_like_summary(target_story uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare story_author uuid; total bigint; mine boolean;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select author_id into story_author from public.social_stories
 where id=target_story and expires_at>now();
 if not found or (story_author<>auth.uid() and not public.are_friends(auth.uid(),story_author))
 then raise exception 'Story inaccessible'; end if;
 select count(*),coalesce(bool_or(user_id=auth.uid()),false) into total,mine
 from public.social_story_likes where story_id=target_story;
 return jsonb_build_object('count',total,'liked',mine);
end $$;
revoke all on function public.story_like_summary(uuid) from public,anon;
grant execute on function public.story_like_summary(uuid) to authenticated;

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and
 not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
   and schemaname='public' and tablename='social_story_likes') then
   alter publication supabase_realtime add table public.social_story_likes;
 end if;
end $$;
commit;
