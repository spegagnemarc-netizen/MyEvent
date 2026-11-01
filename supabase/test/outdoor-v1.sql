-- TEST only. Applied explicitly to ahyyknfjsielnqyoxqgh, never by a deploy hook.
create function public.outdoor_geometry_valid(g jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare l jsonb; p jsonb; n integer:=0;
begin
 if g->>'type' is distinct from 'MultiLineString' or jsonb_typeof(g->'coordinates') is distinct from 'array' or jsonb_array_length(g->'coordinates') not between 1 and 2000 then return false;end if;
 for l in select value from jsonb_array_elements(g->'coordinates') loop
  if jsonb_typeof(l)<>'array' or jsonb_array_length(l)<2 then return false;end if;
  for p in select value from jsonb_array_elements(l) loop
   n:=n+1;if n>20000 or jsonb_typeof(p)<>'array' or jsonb_array_length(p) not between 2 and 3 then return false;end if;
   if jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or abs((p->>0)::numeric)>180 or abs((p->>1)::numeric)>90 then return false;end if;
   if jsonb_array_length(p)=3 and (jsonb_typeof(p->2)<>'number' or abs((p->>2)::numeric)>20000) then return false;end if;
  end loop;
 end loop;return true;
exception when others then return false;end $$;
revoke all on function public.outdoor_geometry_valid(jsonb) from public;
grant execute on function public.outdoor_geometry_valid(jsonb) to authenticated;
create table public.outdoor_routes(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 name text not null check(length(btrim(name)) between 1 and 160),description text not null default '' check(length(description)<=5000),
 activity text not null check(activity in('hike','walk','cycle','gravel','mtb')),
 visibility text not null default 'private' check(visibility in('public','private')),
 geometry jsonb not null check(public.outdoor_geometry_valid(geometry)),
 distance_km numeric not null check(distance_km between 0 and 10000),duration_min integer not null check(duration_min between 1 and 200000),
 difficulty text not null default 'unknown' check(length(difficulty)<=80),ascent_m integer check(ascent_m between 0 and 200000),descent_m integer check(descent_m between 0 and 200000),
 source_name text not null check(length(source_name)<=200),source_url text check(source_url is null or source_url ~ '^https://'),license text not null check(length(license)<=80),
 created_at timestamptz not null default now()
);
alter table public.outdoor_routes enable row level security;
create policy outdoor_account_active on public.outdoor_routes as restrictive for all to authenticated using((select public.myevent_account_active())) with check((select public.myevent_account_active()));
create index outdoor_routes_owner_idx on public.outdoor_routes(owner_id);
create index outdoor_routes_public_idx on public.outdoor_routes(activity,created_at desc) where visibility='public';
create policy outdoor_read on public.outdoor_routes for select to authenticated using(owner_id=(select auth.uid()) or visibility='public');
create policy outdoor_insert on public.outdoor_routes for insert to authenticated with check(owner_id=(select auth.uid()));
create policy outdoor_update on public.outdoor_routes for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select,insert,update on public.outdoor_routes to authenticated;
create table public.outdoor_saved_routes(user_id uuid not null references auth.users(id),route_id uuid not null references public.outdoor_routes(id) on delete cascade,created_at timestamptz default now(),primary key(user_id,route_id));
alter table public.outdoor_saved_routes enable row level security;
create policy outdoor_saved_account_active on public.outdoor_saved_routes as restrictive for all to authenticated using((select public.myevent_account_active())) with check((select public.myevent_account_active()));
create index outdoor_saved_route_idx on public.outdoor_saved_routes(route_id);
create policy outdoor_saved_read on public.outdoor_saved_routes for select to authenticated using(user_id=(select auth.uid()));
create policy outdoor_saved_insert on public.outdoor_saved_routes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.outdoor_routes r where r.id=route_id));
create policy outdoor_saved_delete on public.outdoor_saved_routes for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,delete on public.outdoor_saved_routes to authenticated;
create table public.outdoor_event_routes(event_id uuid primary key references public.events(id) on delete cascade,route_id uuid not null references public.outdoor_routes(id),snapshot jsonb not null,created_at timestamptz default now());
alter table public.outdoor_event_routes enable row level security;
create policy outdoor_event_account_active on public.outdoor_event_routes as restrictive for all to authenticated using((select public.myevent_account_active())) with check((select public.myevent_account_active()));
create index outdoor_event_route_idx on public.outdoor_event_routes(route_id);
create policy outdoor_event_read on public.outdoor_event_routes for select to authenticated using(
 exists(select 1 from public.events e where e.id=event_id and e.creator_id=(select auth.uid())) or
 exists(select 1 from public.event_members m where m.event_id=outdoor_event_routes.event_id and m.user_id=(select auth.uid()) and m.status in('active','confirmed','accepted')));
create policy outdoor_event_insert on public.outdoor_event_routes for insert to authenticated with check(
 exists(select 1 from public.events e where e.id=event_id and e.creator_id=(select auth.uid())) and
 exists(select 1 from public.outdoor_routes r where r.id=route_id));
grant select,insert on public.outdoor_event_routes to authenticated;
create function public.outdoor_event_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$begin
 select to_jsonb(r) into new.snapshot from public.outdoor_routes r where r.id=new.route_id;
 if new.snapshot is null then raise exception 'Parcours inaccessible';end if;return new;end $$;
revoke all on function public.outdoor_event_snapshot() from public;
create trigger outdoor_snapshot_before_insert before insert on public.outdoor_event_routes for each row execute function public.outdoor_event_snapshot();
