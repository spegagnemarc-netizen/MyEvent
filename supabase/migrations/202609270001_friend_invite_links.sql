-- A one-use invitation link lets a signed-in recipient accept friendship with its creator.
create table public.friend_invites (
  token uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);
create index friend_invites_inviter_idx on public.friend_invites(inviter_id);
alter table public.friend_invites enable row level security;
revoke all on public.friend_invites from anon, authenticated;

create function public.create_friend_invite()
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.friend_invites(inviter_id) values (auth.uid()) returning token into invitation;
  return invitation;
end $$;

create function public.friend_invite_preview(invitation uuid)
returns table(id uuid, display_name text, username text, avatar text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name::text, p.username::text, p.avatar::text
  from public.friend_invites i join public.profiles p on p.id = i.inviter_id
  where i.token = invitation and i.expires_at > now() and i.accepted_at is null
    and auth.uid() is not null and i.inviter_id <> auth.uid()
$$;

create function public.accept_friend_invite(invitation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); inviter uuid; lo uuid; hi uuid;
begin
  if me is null then raise exception 'Connexion requise'; end if;
  select inviter_id into inviter from public.friend_invites
    where token = invitation and expires_at > now() and accepted_at is null for update;
  if inviter is null or inviter = me then raise exception 'Invitation invalide ou expirée'; end if;
  lo := least(me, inviter); hi := greatest(me, inviter);
  perform pg_advisory_xact_lock(hashtextextended(lo::text || hi::text, 0));
  insert into public.friendships(user_low,user_high,requester,status)
    values (lo,hi,inviter,'accepted')
    on conflict(user_low,user_high) do update set status='accepted', updated_at=now();
  update public.friend_invites set accepted_by=me, accepted_at=now() where token=invitation;
  return inviter;
end $$;

revoke all on function public.create_friend_invite() from public;
revoke all on function public.friend_invite_preview(uuid) from public;
revoke all on function public.accept_friend_invite(uuid) from public;
grant execute on function public.create_friend_invite() to authenticated;
grant execute on function public.friend_invite_preview(uuid) to authenticated;
grant execute on function public.accept_friend_invite(uuid) to authenticated;
