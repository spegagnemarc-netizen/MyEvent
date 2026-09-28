-- Repair event creation after the event roles/visibility RLS hardening.
-- A legacy policy named event_member_guard_v2 on public.events can require
-- membership before the event row exists, making every INSERT impossible.
-- Event creation is instead authorized strictly when creator_id = auth.uid().

alter table public.events enable row level security;

drop policy if exists event_member_guard_v2 on public.events;

-- Ensure there is a permissive INSERT policy: restrictive policies alone never
-- grant access. Keep the restrictive owner check as defence in depth.
drop policy if exists event_owner_insert_v2 on public.events;
create policy event_owner_insert_v2
  on public.events
  for insert
  to authenticated
  with check (creator_id = auth.uid());

drop policy if exists event_owner_insert_guard_v2 on public.events;
create policy event_owner_insert_guard_v2
  on public.events
  as restrictive
  for insert
  to authenticated
  with check (creator_id = auth.uid());
