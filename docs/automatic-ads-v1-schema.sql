-- PROPOSAL ONLY. Apply first in TEST after review, never automatically in Production.
-- Requires the existing myevent_is_admin() and myevent_account_active().
begin;
create table public.automatic_ad_settings (
 id boolean primary key default true check (id),
 enabled boolean not null default false,
 feed_enabled boolean not null default true,
 spacing integer not null default 8 check (spacing between 5 and 30),
 max_slots integer not null default 2 check (max_slots between 0 and 2),
 publisher_id text not null default '' check (publisher_id='' or publisher_id ~ '^ca-pub-[0-9]{16}$'),
 slot_id text not null default '' check (slot_id='' or slot_id ~ '^[0-9]{10}$'),
 cmp_id integer not null default 0 check (cmp_id between 0 and 65535),
 approved boolean not null default false
);
alter table public.automatic_ad_settings enable row level security;
revoke all on public.automatic_ad_settings from public, anon, authenticated;
grant select, update on public.automatic_ad_settings to authenticated;
create policy automatic_ads_read on public.automatic_ad_settings for select to authenticated
 using ((select public.myevent_account_active()));
create policy automatic_ads_admin_update on public.automatic_ad_settings for update to authenticated
 using ((select public.myevent_is_admin()) and (select public.myevent_account_active()))
 with check ((select public.myevent_is_admin()) and (select public.myevent_account_active()));
insert into public.automatic_ad_settings(id) values(true);
commit;
