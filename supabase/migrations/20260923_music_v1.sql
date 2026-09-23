-- MyEvent Music V1 — collaborative event playlists, votes, favorites and settings
create extension if not exists pgcrypto;

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_track_id text not null,
  title text not null,
  artist text,
  thumbnail_url text,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_track_id)
);

create table if not exists public.music_playlists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Playlist de l’événement',
  created_by uuid not null references auth.users(id) on delete cascade,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists music_playlists_event_idx on public.music_playlists(event_id);

create table if not exists public.music_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.music_playlists(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  position integer,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(playlist_id, track_id)
);
create index if not exists music_playlist_items_event_idx on public.music_playlist_items(event_id);

create table if not exists public.music_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  playlist_item_id uuid not null references public.music_playlist_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null default 1 check (value in (-1,1)),
  created_at timestamptz not null default now(),
  unique(playlist_item_id,user_id)
);
create index if not exists music_votes_event_idx on public.music_votes(event_id);

create table if not exists public.music_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id,track_id)
);

create table if not exists public.event_music_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  proposals_enabled boolean not null default true,
  votes_enabled boolean not null default true,
  dj_mode text not null default 'manual' check (dj_mode in ('manual','auto')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Membership helper: supports current MyEvent event creator and participants model.
create or replace function public.myevent_music_event_member(target_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.events e where e.id=target_event and e.creator_id=auth.uid())
  or exists(select 1 from public.event_members p where p.event_id=target_event and p.user_id=auth.uid());
$$;

create or replace function public.myevent_music_event_owner(target_event uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.events e where e.id=target_event and e.creator_id=auth.uid());
$$;

alter table public.music_tracks enable row level security;
alter table public.music_playlists enable row level security;
alter table public.music_playlist_items enable row level security;
alter table public.music_votes enable row level security;
alter table public.music_favorites enable row level security;
alter table public.event_music_settings enable row level security;

create policy "music tracks authenticated read" on public.music_tracks for select to authenticated using (true);
create policy "music tracks authenticated insert" on public.music_tracks for insert to authenticated with check (true);

create policy "event members read music playlists" on public.music_playlists for select to authenticated using (public.myevent_music_event_member(event_id));
create policy "event members create music playlists" on public.music_playlists for insert to authenticated with check (public.myevent_music_event_member(event_id) and created_by=auth.uid());
create policy "event owners update music playlists" on public.music_playlists for update to authenticated using (public.myevent_music_event_owner(event_id)) with check (public.myevent_music_event_owner(event_id));
create policy "event owners delete music playlists" on public.music_playlists for delete to authenticated using (public.myevent_music_event_owner(event_id));

create policy "event members read music items" on public.music_playlist_items for select to authenticated using (public.myevent_music_event_member(event_id));
create policy "event members add music items" on public.music_playlist_items for insert to authenticated with check (public.myevent_music_event_member(event_id) and proposed_by=auth.uid());
create policy "event owners update music items" on public.music_playlist_items for update to authenticated using (public.myevent_music_event_owner(event_id)) with check (public.myevent_music_event_owner(event_id));
create policy "proposer or owner delete music items" on public.music_playlist_items for delete to authenticated using (proposed_by=auth.uid() or public.myevent_music_event_owner(event_id));

create policy "event members read music votes" on public.music_votes for select to authenticated using (public.myevent_music_event_member(event_id));
create policy "event members vote music" on public.music_votes for insert to authenticated with check (public.myevent_music_event_member(event_id) and user_id=auth.uid());
create policy "users update own music votes" on public.music_votes for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.myevent_music_event_member(event_id));
create policy "users delete own music votes" on public.music_votes for delete to authenticated using (user_id=auth.uid());

create policy "users read own music favorites" on public.music_favorites for select to authenticated using (user_id=auth.uid());
create policy "users add own music favorites" on public.music_favorites for insert to authenticated with check (user_id=auth.uid());
create policy "users delete own music favorites" on public.music_favorites for delete to authenticated using (user_id=auth.uid());

create policy "event members read music settings" on public.event_music_settings for select to authenticated using (public.myevent_music_event_member(event_id));
create policy "event owners create music settings" on public.event_music_settings for insert to authenticated with check (public.myevent_music_event_owner(event_id) and updated_by=auth.uid());
create policy "event owners update music settings" on public.event_music_settings for update to authenticated using (public.myevent_music_event_owner(event_id)) with check (public.myevent_music_event_owner(event_id));
