-- REVIEW SOURCE ONLY. New schema; no existing activity table, RPC, RLS or grant is changed.
-- Not applied to any remote database. The guarded proposal is generated separately.
create schema venue_catalog_private;
revoke all on schema venue_catalog_private from public,anon,authenticated;
grant usage on schema venue_catalog_private to authenticated;
create table venue_catalog_private.places(
 id uuid primary key default gen_random_uuid(),
 canonical_url text not null unique check(length(canonical_url)<=2000 and canonical_url ~ '^https://[^/@?#:]+\.[^/@?#:]+(/[^#]*)?$' and canonical_url !~* '[?&](phpsessid|session|token|access_token)='),
 name text not null check(length(trim(name)) between 1 and 200),
 address text check(length(address)<=300),city text check(length(city)<=100),latitude double precision,longitude double precision,
 provider text not null default 'manual' check(provider in ('manual','official_site','openstreetmap')),
 provider_id text check(length(provider_id)<=200),submitted_by uuid references auth.users(id) on delete set null,
 state text not null default 'pending' check(state in ('pending','approved','hidden')),
 storage_policy text not null default 'unreviewed' check(storage_policy in ('unreviewed','metadata_only','licensed_excerpt','blocked')),
 license_notes text not null default '' check(length(license_notes)<=2000),rights_reviewed_by uuid references auth.users(id),rights_reviewed_at timestamptz,rights_expire_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((latitude is null and longitude is null) or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)),
 check(state<>'approved' or (storage_policy in ('metadata_only','licensed_excerpt') and rights_reviewed_by is not null and rights_reviewed_at is not null and rights_expire_at is not null and length(trim(license_notes))>0))
);
create unique index venue_provider_identity on venue_catalog_private.places(provider,provider_id) where provider_id is not null;
-- Candidate duplicates only: names alone must never automatically merge establishments.
create index venue_name_city_candidates on venue_catalog_private.places(lower(name),lower(city));
create index venue_submissions on venue_catalog_private.places(submitted_by,created_at);
create table venue_catalog_private.sources(
 id uuid primary key default gen_random_uuid(),place_id uuid not null references venue_catalog_private.places(id),
 url text not null check(length(url)<=2000 and url ~ '^https://'),kind text not null check(kind in ('html','pdf','manual','provider_metadata')),
 field text not null check(field in ('identity','address','geo','opening_hours','activity_hours','prices','conditions','booking')),
 content_hash text check(content_hash ~ '^[0-9a-f]{64}$'),checked_at timestamptz not null,source_date date,effective_from date,effective_until date,
 validity text not null default 'unconfirmed' check(validity in ('unconfirmed','dated','expired')),
 -- No full HTML, PDF or provider response blob. Excerpts need explicit licensed_excerpt approval.
 facts jsonb not null default '{}'::jsonb check(octet_length(facts::text)<=16000),excerpt text check(length(excerpt)<=2000),
 unique(place_id,url,field,checked_at),check(effective_from is null or effective_until is null or effective_until>=effective_from)
);
create table venue_catalog_private.revisions(
 id uuid primary key default gen_random_uuid(),place_id uuid not null references venue_catalog_private.places(id),
 author_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 patch jsonb not null check(octet_length(patch::text)<=20000),state text not null default 'pending' check(state in ('pending','accepted','rejected')),
 reason text not null default '' check(length(reason)<=2000)
);
create table venue_catalog_private.favorites(
 user_id uuid not null references auth.users(id) on delete cascade,place_id uuid not null references venue_catalog_private.places(id),created_at timestamptz not null default now(),primary key(user_id,place_id)
);
create table venue_catalog_private.activity_venues(
 activity_id uuid primary key references activities_private.activities(id),place_id uuid not null references venue_catalog_private.places(id),
 confirmed_by uuid not null references auth.users(id),confirmed_at timestamptz not null default now(),
 -- Organiser corrections remain private to this activity; they do not overwrite source facts.
 organizer_notes jsonb not null default '{}'::jsonb check(octet_length(organizer_notes::text)<=20000)
);
create function venue_catalog_private.visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.myevent_account_active() and exists(select 1 from venue_catalog_private.places where id=p_id and state='approved' and storage_policy in ('metadata_only','licensed_excerpt') and rights_expire_at>now())
$$;
create function venue_catalog_private.can_read_activity(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and activities_private.visible(p_id) and exists(select 1 from activities_private.activities a where a.id=p_id and (a.organizer_id=auth.uid() or exists(select 1 from activities_private.members m where m.activity_id=p_id and m.user_id=auth.uid() and m.status='accepted')))
$$;
do $$declare t text;begin foreach t in array array['places','sources','revisions','favorites','activity_venues'] loop
 execute format('alter table venue_catalog_private.%I enable row level security',t);
 execute format('revoke all on venue_catalog_private.%I from public,anon,authenticated',t);
end loop;end $$;
create policy venue_read on venue_catalog_private.places for select to authenticated using((select public.myevent_account_active()) and (submitted_by=(select auth.uid()) or venue_catalog_private.visible(id)));
create policy source_read on venue_catalog_private.sources for select to authenticated using(venue_catalog_private.visible(place_id) and (excerpt is null or exists(select 1 from venue_catalog_private.places p where p.id=place_id and p.storage_policy='licensed_excerpt')));
create policy revision_own on venue_catalog_private.revisions for select to authenticated using(author_id=(select auth.uid()) and (select public.myevent_account_active()));
create policy favorite_read on venue_catalog_private.favorites for select to authenticated using(user_id=(select auth.uid()) and (select public.myevent_account_active()));
create policy favorite_insert on venue_catalog_private.favorites for insert to authenticated with check(user_id=(select auth.uid()) and venue_catalog_private.visible(place_id));
create policy favorite_delete on venue_catalog_private.favorites for delete to authenticated using(user_id=(select auth.uid()) and (select public.myevent_account_active()));
create policy activity_venue_read on venue_catalog_private.activity_venues for select to authenticated using(venue_catalog_private.can_read_activity(activity_id));
grant select(id,canonical_url,name,address,city,latitude,longitude,provider,provider_id,state,storage_policy,rights_expire_at,created_at,updated_at) on venue_catalog_private.places to authenticated;
grant select on venue_catalog_private.sources,venue_catalog_private.revisions,venue_catalog_private.favorites,venue_catalog_private.activity_venues to authenticated;
grant insert(user_id,place_id),delete on venue_catalog_private.favorites to authenticated;
create function venue_catalog_private.submit(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();v_id uuid;n integer;url text:=trim(p_data->>'canonical_url');
begin
 if me is null or not public.myevent_account_active() then raise exception 'Compte non autorisé'; end if;
 perform pg_advisory_xact_lock(hashtextextended('venue-submit:'||me::text,0));
 select id into v_id from venue_catalog_private.places where canonical_url=url and (submitted_by=me or venue_catalog_private.visible(id));
 if found then return v_id; end if;
 select count(*) into n from venue_catalog_private.places where submitted_by=me and created_at>now()-interval '1 day';
 if n>=5 then raise exception 'Limite de propositions atteinte'; end if;
 insert into venue_catalog_private.places(canonical_url,name,address,city,latitude,longitude,submitted_by)
 values(url,trim(p_data->>'name'),p_data->>'address',p_data->>'city',(p_data->>'latitude')::double precision,(p_data->>'longitude')::double precision,me) returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'Lieu déjà connu ou en cours de vérification';
end $$;
create function venue_catalog_private.link_activity(p_activity uuid,p_place uuid,p_notes jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not activities_private.allowed() then raise exception 'Activités désactivées ou accès non autorisé'; end if;
 perform 1 from activities_private.activities where id=p_activity and organizer_id=auth.uid() and status='open' for update;
 if not found or not venue_catalog_private.visible(p_place) then raise exception 'Association non autorisée'; end if;
 insert into venue_catalog_private.activity_venues(activity_id,place_id,confirmed_by,organizer_notes) values(p_activity,p_place,auth.uid(),p_notes)
 on conflict(activity_id) do update set place_id=excluded.place_id,confirmed_by=excluded.confirmed_by,confirmed_at=clock_timestamp(),organizer_notes=excluded.organizer_notes;
end $$;
create function public.venue_catalog_search(p_query text default '',p_limit integer default 20) returns table(id uuid,canonical_url text,name text,address text,city text,latitude double precision,longitude double precision,provider text) language sql stable security invoker set search_path='' as $$
 select p.id,p.canonical_url,p.name,p.address,p.city,p.latitude,p.longitude,p.provider from venue_catalog_private.places p where venue_catalog_private.visible(p.id) and (p.name ilike '%'||left(coalesce(p_query,''),100)||'%' or p.city ilike '%'||left(coalesce(p_query,''),100)||'%') order by p.name,p.id limit greatest(1,least(coalesce(p_limit,20),50))
$$;
create function public.venue_catalog_submit(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select venue_catalog_private.submit(p_data)$$;
create function public.venue_catalog_favorite(p_place uuid,p_favorite boolean) returns void language plpgsql security invoker set search_path='' as $$
begin if p_favorite then insert into venue_catalog_private.favorites(user_id,place_id) values(auth.uid(),p_place) on conflict do nothing;
else delete from venue_catalog_private.favorites where user_id=auth.uid() and place_id=p_place;end if;end $$;
create function public.venue_catalog_link_activity(p_activity uuid,p_place uuid,p_notes jsonb default '{}'::jsonb) returns void language sql security invoker set search_path='' as $$select venue_catalog_private.link_activity(p_activity,p_place,p_notes)$$;
revoke all on all functions in schema venue_catalog_private from public,anon,authenticated;
grant execute on function venue_catalog_private.visible(uuid),venue_catalog_private.can_read_activity(uuid),venue_catalog_private.submit(jsonb),venue_catalog_private.link_activity(uuid,uuid,jsonb) to authenticated;
revoke all on function public.venue_catalog_search(text,integer),public.venue_catalog_submit(jsonb),public.venue_catalog_favorite(uuid,boolean),public.venue_catalog_link_activity(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.venue_catalog_search(text,integer),public.venue_catalog_submit(jsonb),public.venue_catalog_favorite(uuid,boolean),public.venue_catalog_link_activity(uuid,uuid,jsonb) to authenticated;
