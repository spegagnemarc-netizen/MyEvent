-- V1 realtime coverage for collaborative event modules and marketplace.
-- Idempotent: only adds existing tables not already present in the publication.
do $$
declare
  t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array[
      'event_outings',
      'event_outing_plans',
      'event_outing_plan_items',
      'event_outing_plan_reservations',
      'event_hall_settings',
      'event_fund_entries',
      'event_fund_settings',
      'event_supplies',
      'marketplace_messages',
      'marketplace_threads',
      'marketplace_listings'
    ] loop
      if to_regclass('public.'||t) is not null
         and not exists(
           select 1 from pg_publication_tables
           where pubname='supabase_realtime' and schemaname='public' and tablename=t
         ) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
