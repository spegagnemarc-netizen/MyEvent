-- Global friend location sharing for the home "À proximité" map.
-- Exact coordinates are never directly readable by other users: friends read through the RPC.

create table if not exists public.social_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision,
  lon double precision,
  accuracy double precision,
  share_mode text not null default 'off' check (share_mode in ('off','exact','approx')),
  updated_at timestamptz not null default now()
);

alter table public.social_locations enable row level security;

drop policy if exists social_locations_owner_select on public.social_locations;
create policy social_locations_owner_select on public.social_locations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists social_locations_owner_insert on public.social_locations;
create policy social_locations_owner_insert on public.social_locations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists social_locations_owner_update on public.social_locations;
create policy social_locations_owner_update on public.social_locations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists social_locations_owner_delete on public.social_locations;
create policy social_locations_owner_delete on public.social_locations
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.nearby_friend_locations()
returns table (
  user_id uuid,
  lat double precision,
  lon double precision,
  share_mode text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sl.user_id,
    case when sl.share_mode = 'approx' then round(sl.lat::numeric, 2)::double precision else sl.lat end,
    case when sl.share_mode = 'approx' then round(sl.lon::numeric, 2)::double precision else sl.lon end,
    sl.share_mode,
    sl.updated_at
  from public.social_locations sl
  where auth.uid() is not null
    and sl.share_mode <> 'off'
    and sl.lat is not null
    and sl.lon is not null
    and public.are_friends(auth.uid(), sl.user_id);
$$;

revoke all on function public.nearby_friend_locations() from public;
grant execute on function public.nearby_friend_locations() to authenticated;
