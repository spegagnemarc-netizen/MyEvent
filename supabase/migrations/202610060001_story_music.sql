-- Optional MyEvent Music track attached to a 24-hour Story.
alter table public.social_stories
  add column if not exists music_track_id uuid references public.music_tracks(id) on delete set null,
  add column if not exists music_start_seconds integer not null default 0,
  add column if not exists music_duration_seconds integer not null default 15;

create index if not exists social_stories_music_track_idx
  on public.social_stories(music_track_id)
  where music_track_id is not null;

comment on column public.social_stories.music_track_id is
  'Optional MyEvent Music track selected by the Story author.';


alter table public.social_stories
  drop constraint if exists social_stories_music_start_seconds_check,
  add constraint social_stories_music_start_seconds_check check (music_start_seconds between 0 and 86400),
  drop constraint if exists social_stories_music_duration_seconds_check,
  add constraint social_stories_music_duration_seconds_check check (music_duration_seconds between 5 and 30);

comment on column public.social_stories.music_start_seconds is
  'Start position of the selected Story music excerpt, in seconds.';
comment on column public.social_stories.music_duration_seconds is
  'Duration of the selected Story music excerpt, in seconds (5 to 30).';
