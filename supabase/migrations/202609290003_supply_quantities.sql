-- Allow several event members to share the quantity of one supply item.
create table if not exists public.event_supply_contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  supply_id uuid not null references public.event_supplies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved','brought')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supply_id,user_id)
);
create index if not exists event_supply_contributions_event_idx on public.event_supply_contributions(event_id);
create index if not exists event_supply_contributions_supply_idx on public.event_supply_contributions(supply_id);
alter table public.event_supply_contributions enable row level security;
drop policy if exists "event_supply_contributions_select" on public.event_supply_contributions;
create policy "event_supply_contributions_select" on public.event_supply_contributions for select to authenticated using (public.event_is_member(event_id));
drop policy if exists "event_supply_contributions_insert" on public.event_supply_contributions;
create policy "event_supply_contributions_insert" on public.event_supply_contributions for insert to authenticated with check (user_id=auth.uid() and public.event_is_member(event_id) and exists(select 1 from public.event_supplies s where s.id=supply_id and s.event_id=event_id));
drop policy if exists "event_supply_contributions_update" on public.event_supply_contributions;
create policy "event_supply_contributions_update" on public.event_supply_contributions for update to authenticated using (user_id=auth.uid() or public.event_is_manager(event_id)) with check ((user_id=auth.uid() or public.event_is_manager(event_id)) and exists(select 1 from public.event_supplies s where s.id=supply_id and s.event_id=event_id));
drop policy if exists "event_supply_contributions_delete" on public.event_supply_contributions;
create policy "event_supply_contributions_delete" on public.event_supply_contributions for delete to authenticated using (user_id=auth.uid() or public.event_is_manager(event_id));
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='event_supply_contributions') then
    alter publication supabase_realtime add table public.event_supply_contributions;
  end if;
end $$;
