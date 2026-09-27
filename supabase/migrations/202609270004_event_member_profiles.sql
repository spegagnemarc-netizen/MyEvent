-- Public-facing profiles for members of the same event.
-- Keeps profiles private globally: callers only receive the four display fields
-- for users who belong to an event the caller also belongs to (or owns).
create or replace function public.event_member_profiles(p_event_id uuid)
returns table(id uuid, display_name text, username text, avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name::text, p.username::text, p.avatar::text
  from public.profiles p
  where exists (
    select 1
    from public.event_members target_member
    where target_member.event_id = p_event_id
      and target_member.user_id = p.id
  )
  and (
    exists (
      select 1
      from public.event_members caller_member
      where caller_member.event_id = p_event_id
        and caller_member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and e.creator_id = auth.uid()
    )
  )
  order by p.display_name nulls last, p.username nulls last
  limit 500;
$$;

revoke all on function public.event_member_profiles(uuid) from public;
grant execute on function public.event_member_profiles(uuid) to authenticated;
