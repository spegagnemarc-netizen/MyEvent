-- Optional MyEvent Music track attached to a 24-hour Story.
alter table public.social_stories
  add column if not exists music_track_id uuid references public.music_tracks(id) on delete set null;

create index if not exists social_stories_music_track_idx
  on public.social_stories(music_track_id)
  where music_track_id is not null;

comment on column public.social_stories.music_track_id is
  'Optional MyEvent Music track selected by the Story author.';
