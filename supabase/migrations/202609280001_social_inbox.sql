-- Persistent social inbox. Requires the existing friendships, profiles and games migrations.
begin;
create table public.dm_conversations (
 id uuid primary key default gen_random_uuid(),
 user_low uuid not null references auth.users(id) on delete cascade,
 user_high uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_low,user_high), check(user_low<user_high)
);
create index dm_conversations_high on public.dm_conversations(user_high,updated_at desc);
create index dm_conversations_low on public.dm_conversations(user_low,updated_at desc);
create table public.dm_messages (
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null,
 body text not null default '' check(char_length(body)<=4000),
 media_path text unique,
 created_at timestamptz not null default now(),
 unique(sender_id,client_id),
 check(length(trim(body))>0 or media_path is not null)
);
create index dm_messages_conversation on public.dm_messages(conversation_id,id desc);
create table public.dm_reads (
 conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_id bigint not null default 0,
 primary key(conversation_id,user_id)
);
create table public.social_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('friend_request','friend_accepted','private_message','game_invitation')),
 reference_id uuid not null,
 conversation_id uuid references public.dm_conversations(id) on delete cascade,
 last_message_id bigint,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,kind,reference_id)
);
create index social_notifications_owner on public.social_notifications(user_id,created_at desc);
create index social_notifications_unread on public.social_notifications(user_id) where read_at is null;

create function public.dm_is_member(target_conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dm_conversations where id=target_conversation and auth.uid() in(user_low,user_high))
$$;
revoke all on function public.dm_is_member(uuid) from public,anon;
grant execute on function public.dm_is_member(uuid) to authenticated;
alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_reads enable row level security;
alter table public.social_notifications enable row level security;
revoke all on public.dm_conversations,public.dm_messages,public.dm_reads,public.social_notifications from anon,authenticated;
revoke all on sequence public.dm_messages_id_seq from anon,authenticated;
grant select on public.dm_conversations,public.dm_messages,public.dm_reads,public.social_notifications to authenticated;
create policy dm_conversations_own on public.dm_conversations for select to authenticated using(auth.uid() in(user_low,user_high));
create policy dm_messages_own on public.dm_messages for select to authenticated using(public.dm_is_member(conversation_id));
create policy dm_reads_own on public.dm_reads for select to authenticated using(user_id=auth.uid());
create policy social_notifications_own on public.social_notifications for select to authenticated using(user_id=auth.uid());

create function public.dm_open(other_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); cid uuid;
begin
 if me is null or other_id is null or me=other_id or not public.are_friends(me,other_id)
 or not exists(select 1 from public.profiles where id=other_id) then raise exception 'Une amitié acceptée est nécessaire'; end if;
 insert into public.dm_conversations(user_low,user_high) values(least(me,other_id),greatest(me,other_id))
 on conflict(user_low,user_high) do nothing;
 select id into cid from public.dm_conversations where user_low=least(me,other_id) and user_high=greatest(me,other_id);
 return cid;
end $$;

create function public.dm_history(target_conversation uuid,before_id bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.dm_conversations%rowtype; result jsonb;
begin
 select * into c from public.dm_conversations where id=target_conversation and auth.uid() in(user_low,user_high);
 if not found then raise exception 'Conversation inaccessible'; end if;
 select coalesce(jsonb_agg(to_jsonb(m)-'sort_id' order by m.sort_id),'[]') into result from (
  select id::text id,id sort_id,sender_id,body,media_path,created_at,client_id from public.dm_messages
  where conversation_id=c.id and (before_id is null or id<before_id) order by id desc limit 50
 ) m;
 return jsonb_build_object('messages',result,'can_send',public.are_friends(c.user_low,c.user_high),
 'peer',(select jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar',p.avatar)
 from public.profiles p where p.id=case when c.user_low=auth.uid() then c.user_high else c.user_low end));
end $$;

create function public.dm_send(target_conversation uuid,message_body text,client_nonce uuid,photo_path text default null) returns text
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); c public.dm_conversations%rowtype; previous public.dm_messages%rowtype; mid bigint; recipient uuid; clean text:=trim(coalesce(message_body,''));
begin
 select * into c from public.dm_conversations where id=target_conversation and me in(user_low,user_high) for update;
 if not found then raise exception 'Conversation inaccessible'; end if;
 -- Retry the same operation without generating duplicate messages/notifications.
 select * into previous from public.dm_messages where sender_id=me and client_id=client_nonce;
 if found then
  if previous.conversation_id<>c.id or previous.body<>clean or previous.media_path is distinct from photo_path then raise exception 'Identifiant de message déjà utilisé'; end if;
  return previous.id::text;
 end if;
 if not public.are_friends(c.user_low,c.user_high) then raise exception 'Vous devez être amis pour envoyer un message'; end if;
 if client_nonce is null or char_length(clean)>4000 or (clean='' and photo_path is null) then raise exception 'Message vide ou trop long'; end if;
 if photo_path is not null and (split_part(photo_path,'/',1)<>me::text or split_part(photo_path,'/',2)<>c.id::text
  or not exists(select 1 from storage.objects where bucket_id='dm-media' and name=photo_path)) then raise exception 'Photo privée invalide'; end if;
 insert into public.dm_messages(conversation_id,sender_id,client_id,body,media_path) values(c.id,me,client_nonce,clean,photo_path) returning id into mid;
 update public.dm_conversations set updated_at=clock_timestamp() where id=c.id;
 recipient:=case when me=c.user_low then c.user_high else c.user_low end;
 insert into public.social_notifications(user_id,actor_id,kind,reference_id,conversation_id,last_message_id)
 values(recipient,me,'private_message',c.id,c.id,mid)
 on conflict(user_id,kind,reference_id) do update set last_message_id=excluded.last_message_id,created_at=clock_timestamp(),read_at=null;
 return mid::text;
end $$;

create function public.dm_mark_read(target_conversation uuid,through_id bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dm_conversations where id=target_conversation and auth.uid() in(user_low,user_high) for update;
 if not found then raise exception 'Conversation inaccessible'; end if;
 if not exists(select 1 from public.dm_messages where id=through_id and conversation_id=target_conversation) then raise exception 'Message inaccessible'; end if;
 insert into public.dm_reads(conversation_id,user_id,last_read_id) values(target_conversation,auth.uid(),through_id)
 on conflict(conversation_id,user_id) do update set last_read_id=greatest(public.dm_reads.last_read_id,excluded.last_read_id);
 update public.social_notifications set read_at=now() where user_id=auth.uid() and conversation_id=target_conversation
 and kind='private_message' and last_message_id<=through_id and read_at is null;
end $$;

create function public.social_notification_read(notification_id uuid) returns void
language sql security definer set search_path='' as $$
 update public.social_notifications set read_at=coalesce(read_at,now()) where id=notification_id and user_id=auth.uid()
$$;

create function public.social_inbox_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid(); conversations jsonb; notifications jsonb; unread_messages bigint;
begin
 if me is null then raise exception 'Connexion requise'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]') into conversations from (
  select c.id,c.updated_at,jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar',p.avatar) peer,
  (select jsonb_build_object('body',m.body,'photo',m.media_path is not null,'created_at',m.created_at,'sender_id',m.sender_id)
   from public.dm_messages m where m.conversation_id=c.id order by m.id desc limit 1) last_message,
  (select count(*) from public.dm_messages m where m.conversation_id=c.id and m.sender_id<>me
   and m.id>coalesce((select last_read_id from public.dm_reads where conversation_id=c.id and user_id=me),0)) unread
  from public.dm_conversations c left join public.profiles p on p.id=case when c.user_low=me then c.user_high else c.user_low end
  where me in(c.user_low,c.user_high) order by c.updated_at desc limit 100
 ) x;
 select count(*) into unread_messages from public.dm_messages m join public.dm_conversations c on c.id=m.conversation_id
 where me in(c.user_low,c.user_high) and m.sender_id<>me and m.id>coalesce((select last_read_id from public.dm_reads where conversation_id=c.id and user_id=me),0);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into notifications from (
  select n.id,n.kind,n.reference_id,n.conversation_id,n.created_at,n.read_at,
   jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar',p.avatar) actor
  from public.social_notifications n left join public.profiles p on p.id=n.actor_id where n.user_id=me order by n.created_at desc limit 100
 ) x;
 return jsonb_build_object('conversations',conversations,'notifications',notifications,'unread_messages',unread_messages,
  'unread_notifications',(select count(*) from public.social_notifications where user_id=me and read_at is null));
end $$;

-- Server-owned notifications; no client insert/update grants.
create function public.social_friend_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; actor uuid; category text;
begin
 if new.status='pending' and TG_OP='INSERT' then
  actor:=new.requester; recipient:=case when actor=new.user_low then new.user_high else new.user_low end; category:='friend_request';
 elsif new.status='accepted' then
  if TG_OP='UPDATE' and old.status='accepted' then return new; end if;
  actor:=case when auth.uid() in(new.user_low,new.user_high) then auth.uid()
    when new.requester=new.user_low then new.user_high else new.user_low end;
  recipient:=case when actor=new.user_low then new.user_high else new.user_low end; category:='friend_accepted';
  update public.social_notifications set read_at=coalesce(read_at,now()) where kind='friend_request'
   and ((user_id=new.user_low and reference_id=new.user_high) or (user_id=new.user_high and reference_id=new.user_low));
 else return new; end if;
 insert into public.social_notifications(user_id,actor_id,kind,reference_id) values(recipient,actor,category,actor)
 on conflict(user_id,kind,reference_id) do update set created_at=clock_timestamp(),read_at=null;
 return new;
end $$;
create trigger social_friend_notification after insert or update of status on public.friendships for each row execute function public.social_friend_notification();
create function public.social_game_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.social_notifications(user_id,actor_id,kind,reference_id) values(new.user_id,new.invited_by,'game_invitation',new.room_id)
 on conflict(user_id,kind,reference_id) do update set created_at=clock_timestamp(),read_at=null;
 return new;
end $$;
create trigger social_game_notification after insert on public.game_invitations for each row execute function public.social_game_notification();
revoke all on function public.social_friend_notification(),public.social_game_notification() from public,anon,authenticated;

-- Dedicated private bucket, never public Story URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('dm-media','dm-media',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function public.dm_media_access(object_name text,for_upload boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case when for_upload then
  split_part(object_name,'/',1)=auth.uid()::text and exists(select 1 from public.dm_conversations c
   where c.id::text=split_part(object_name,'/',2) and auth.uid() in(c.user_low,c.user_high) and public.are_friends(c.user_low,c.user_high))
 else split_part(object_name,'/',1)=auth.uid()::text or exists(select 1 from public.dm_messages m
  where m.media_path=object_name and public.dm_is_member(m.conversation_id)) end
$$;
create function public.dm_media_unattached(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(object_name,'/',1)=auth.uid()::text and not exists(select 1 from public.dm_messages where media_path=object_name)
$$;
create policy dm_media_upload on storage.objects for insert to authenticated with check(bucket_id='dm-media' and public.dm_media_access(name,true));
create policy dm_media_read on storage.objects for select to authenticated using(bucket_id='dm-media' and public.dm_media_access(name,false));
create policy dm_media_cleanup on storage.objects for delete to authenticated using(bucket_id='dm-media' and public.dm_media_unattached(name));

revoke all on function public.dm_open(uuid),public.dm_history(uuid,bigint),public.dm_send(uuid,text,uuid,text),public.dm_mark_read(uuid,bigint),public.social_notification_read(uuid),public.social_inbox_snapshot(),public.dm_media_access(text,boolean),public.dm_media_unattached(text) from public,anon;
grant execute on function public.dm_open(uuid),public.dm_history(uuid,bigint),public.dm_send(uuid,text,uuid,text),public.dm_mark_read(uuid,bigint),public.social_notification_read(uuid),public.social_inbox_snapshot(),public.dm_media_access(text,boolean),public.dm_media_unattached(text) to authenticated;
-- Publish only tables whose RLS restricts rows to the signed-in recipient/members.
do $$ declare tbl text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach tbl in array array['dm_messages','dm_conversations','social_notifications'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
    execute format('alter publication supabase_realtime add table public.%I',tbl);
   end if;
  end loop;
 end if;
end $$;
commit;
