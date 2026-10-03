-- MyEvent V1: private administration. Apply in Supabase SQL Editor.
create table if not exists public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'super_admin' check (role = 'super_admin'),
 created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
-- No client policies: membership is checked exclusively by SECURITY DEFINER functions.
create or replace function public.myevent_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select auth.uid() is not null and exists (
 select 1 from public.platform_admins a where a.user_id = auth.uid() and a.role = 'super_admin'
); $$;
revoke all on function public.myevent_is_admin() from public, anon;
grant execute on function public.myevent_is_admin() to authenticated;

create or replace function public.myevent_admin_overview()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists (
  select 1 from public.platform_admins where user_id = auth.uid() and role = 'super_admin'
 ) then raise exception 'Accès administrateur refusé' using errcode = '42501'; end if;
 select jsonb_build_object(
  'users', (select count(*) from auth.users),
  'events', (select count(*) from public.events),
  'generated_at', now()
 ) into result;
 return result;
end; $$;
revoke all on function public.myevent_admin_overview() from public, anon;
grant execute on function public.myevent_admin_overview() to authenticated;

-- IMPORTANT: After confirming the owner's UUID in Authentication > Users,
-- run separately, replacing ONLY the placeholder with that UUID:
-- insert into public.platform_admins(user_id, role)
-- values ('REPLACE_WITH_OWNER_AUTH_USER_UUID'::uuid, 'super_admin')
-- on conflict (user_id) do update set role = excluded.role;
