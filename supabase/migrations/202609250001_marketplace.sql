-- Marketplace only. Apply once through Supabase migrations / SQL editor.
begin;
create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 90),
  description text not null check (char_length(trim(description)) between 20 and 1800),
  mode text not null check (mode in ('sale','rent')),
  category text not null check (category in ('sound','lights','photo','furniture','decoration','outdoor')),
  price_cents integer not null check (price_cents between 100 and 10000000),
  city text not null check (char_length(trim(city)) between 2 and 60),
  condition text not null check (condition in ('new','like_new','good','used')),
  image_paths text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(image_paths) <= 4),
  check (status <> 'active' or cardinality(image_paths) >= 1)
);
create index marketplace_listings_recent on public.marketplace_listings (status,created_at desc);
create index marketplace_listings_owner on public.marketplace_listings (owner_id);

create function public.marketplace_validate_listing() returns trigger language plpgsql set search_path = '' as $$
declare path text;
begin
  if TG_OP='UPDATE' and (new.id<>old.id or new.owner_id<>old.owner_id or new.created_at<>old.created_at) then
    raise exception 'Listing identity is immutable';
  end if;
  foreach path in array new.image_paths loop
    if path is null or path !~ ('^'||new.owner_id::text||'/'||new.id::text||'/[a-f0-9-]+\.jpg$') then
      raise exception 'Invalid listing image path';
    end if;
    if new.status='active' and not exists(select 1 from storage.objects o where o.bucket_id='marketplace-images' and o.name=path) then
      raise exception 'Upload listing photos before publishing';
    end if;
  end loop;
  new.updated_at=now(); return new;
end $$;
create trigger marketplace_listing_validation before insert or update on public.marketplace_listings
for each row execute function public.marketplace_validate_listing();
revoke all on function public.marketplace_validate_listing() from public;

alter table public.marketplace_listings enable row level security;
create policy marketplace_listing_read on public.marketplace_listings for select to authenticated using(status='active' or owner_id=(select auth.uid()));
create policy marketplace_listing_create on public.marketplace_listings for insert to authenticated with check(owner_id=(select auth.uid()) and status='draft');
create policy marketplace_listing_edit on public.marketplace_listings for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
-- Archive instead of deleting listings, so conversations retain their context.
revoke all on public.marketplace_listings from anon,authenticated;
grant select on public.marketplace_listings to authenticated;
grant insert(id,owner_id,title,description,mode,category,price_cents,city,condition,status) on public.marketplace_listings to authenticated;
grant update(title,description,mode,category,price_cents,city,condition,image_paths,status) on public.marketplace_listings to authenticated;

create table public.marketplace_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  primary key(user_id,listing_id)
);
alter table public.marketplace_favorites enable row level security;
create policy marketplace_favorite_read on public.marketplace_favorites for select to authenticated using(user_id=(select auth.uid()));
create policy marketplace_favorite_create on public.marketplace_favorites for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.marketplace_listings l where l.id=listing_id and l.status='active'));
create policy marketplace_favorite_remove on public.marketplace_favorites for delete to authenticated using(user_id=(select auth.uid()));
revoke all on public.marketplace_favorites from anon,authenticated;
grant select,insert,delete on public.marketplace_favorites to authenticated;

create table public.marketplace_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  listing_title text not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (buyer_id<>seller_id),
  unique(listing_id,buyer_id)
);
create index marketplace_threads_seller on public.marketplace_threads(seller_id);
create index marketplace_threads_buyer on public.marketplace_threads(buyer_id);
alter table public.marketplace_threads enable row level security;
create policy marketplace_thread_read on public.marketplace_threads for select to authenticated using((select auth.uid()) in (buyer_id,seller_id));
revoke all on public.marketplace_threads from anon,authenticated;
grant select on public.marketplace_threads to authenticated;

-- The caller cannot forge a seller, a subject or someone else's buyer identity.
create function public.marketplace_contact(listing uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare item public.marketplace_listings; result uuid; caller uuid:=auth.uid();
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into item from public.marketplace_listings where id=listing and status='active';
  if not found or item.owner_id=caller then raise exception 'Listing unavailable'; end if;
  insert into public.marketplace_threads(listing_id,listing_title,buyer_id,seller_id)
  values(item.id,item.title,caller,item.owner_id)
  on conflict(listing_id,buyer_id) do nothing;
  select id into result from public.marketplace_threads where listing_id=listing and buyer_id=caller;
  return result;
end $$;
revoke all on function public.marketplace_contact(uuid) from public,anon;
grant execute on function public.marketplace_contact(uuid) to authenticated;

create table public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.marketplace_threads(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index marketplace_messages_thread on public.marketplace_messages(thread_id,created_at);
alter table public.marketplace_messages enable row level security;
create policy marketplace_message_read on public.marketplace_messages for select to authenticated using(exists(select 1 from public.marketplace_threads t where t.id=thread_id and (select auth.uid()) in(t.buyer_id,t.seller_id)));
create policy marketplace_message_send on public.marketplace_messages for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.marketplace_threads t where t.id=thread_id and (select auth.uid()) in(t.buyer_id,t.seller_id)));
revoke all on public.marketplace_messages from anon,authenticated;
grant select on public.marketplace_messages to authenticated;
grant insert (id,thread_id,sender_id,body) on public.marketplace_messages to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('marketplace-images','marketplace-images',false,5242880,array['image/jpeg']);
create policy marketplace_image_read on storage.objects for select to authenticated using(
  bucket_id='marketplace-images' and exists(select 1 from public.marketplace_listings l
    where l.id::text=(storage.foldername(name))[2] and l.owner_id::text=(storage.foldername(name))[1]
    and (l.owner_id=(select auth.uid()) or (l.status='active' and name=any(l.image_paths))))
);
create policy marketplace_image_upload on storage.objects for insert to authenticated with check(
  bucket_id='marketplace-images' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.marketplace_listings l where l.id::text=(storage.foldername(name))[2] and l.owner_id=(select auth.uid()))
);
create policy marketplace_image_remove on storage.objects for delete to authenticated using(
  bucket_id='marketplace-images' and (storage.foldername(name))[1]=(select auth.uid())::text
);
commit;
