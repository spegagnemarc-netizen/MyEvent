-- TEST ONLY: verified target session required. No price/duration changes.
begin;
do $$ begin if current_setting('myevent.target_project_ref',true) is distinct from 'ahyyknfjsielnqyoxqgh' then raise exception 'Verified TEST project required';end if;end $$;
alter table public.ad_plans add column if not exists max_campaigns integer check(max_campaigns between 1 and 3);
alter table public.ad_plans add column if not exists feed_priority integer not null default 0;
alter table public.ad_plans add column if not exists detailed_stats boolean not null default false;
update public.ad_plans set max_campaigns=1,geography='department',feed_priority=0,detailed_stats=false where key='premium';
update public.ad_plans set max_campaigns=3,geography='national',feed_priority=100,detailed_stats=true where key='professional';
create table if not exists public.ad_entitlements(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),plan_key text not null references public.ad_plans(key),payment_session text not null unique,price_cents integer not null,max_campaigns integer not null,starts_at timestamptz not null,ends_at timestamptz not null);
alter table public.ad_entitlements enable row level security;
revoke all on public.ad_entitlements from public,anon,authenticated;
alter table public.ad_campaigns add column if not exists entitlement_id uuid references public.ad_entitlements(id);
create table if not exists public.ad_daily_stats(campaign_id uuid not null references public.ad_campaigns(id),day date not null,impressions bigint not null default 0,clicks bigint not null default 0,primary key(campaign_id,day));
alter table public.ad_daily_stats enable row level security;
revoke all on public.ad_daily_stats from public,anon,authenticated;
create or replace function public.myevent_ads_attach_pro(p_owner uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare entitlement public.ad_entitlements;remaining integer;campaign public.ad_campaigns;
begin
 select * into entitlement from public.ad_entitlements where owner_id=p_owner and plan_key='professional' and ends_at>now() order by ends_at desc limit 1 for update;
 if entitlement.id is null then return;end if;
 remaining:=entitlement.max_campaigns-(select count(*) from public.ad_campaigns where entitlement_id=entitlement.id);
 for campaign in select * from public.ad_campaigns where owner_id=p_owner and plan_key='professional' and status='approved' and paid_at is null and entitlement_id is null order by created_at limit greatest(0,remaining) for update loop
  update public.ad_campaigns set entitlement_id=entitlement.id,price_cents=0,paid_at=entitlement.starts_at,starts_at=now(),ends_at=entitlement.ends_at,updated_at=now() where id=campaign.id;
 end loop;
end $$;
revoke all on function public.myevent_ads_attach_pro(uuid) from public,anon,authenticated,service_role;
do $$ begin if to_regprocedure('public.myevent_ads_v2(text,jsonb)') is null then alter function public.myevent_ads(text,jsonb) rename to myevent_ads_v2;end if;end $$;
revoke all on function public.myevent_ads_v2(text,jsonb) from public,anon,authenticated;
create or replace function public.myevent_ads(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();campaign public.ad_campaigns;plan public.ad_plans;result jsonb;attempt public.ad_payment_attempts;
begin
 if uid is null or not coalesce(public.myevent_account_active(),false) then raise exception 'Authentication required' using errcode='42501';end if;
 if p_action='plan' and (p_payload->>'key'='premium' and p_payload->>'geography' is distinct from 'department' or p_payload->>'key'='professional' and p_payload->>'geography' is distinct from 'national') then raise exception 'Offer geography is fixed';end if;
 if p_action in ('create','update') and p_payload->>'plan_key'='professional' and p_payload->>'zone' is distinct from 'national' then raise exception 'Professional targets all France';end if;
 if p_action='review' and p_payload->>'status'='approved' then
  if not coalesce(public.myevent_is_admin(),false) then raise exception 'Administrator required' using errcode='42501';end if;
  select * into campaign from public.ad_campaigns where id=(p_payload->>'id')::uuid for update;
  select * into plan from public.ad_plans where key=campaign.plan_key;
  if plan.max_campaigns is not null then
   perform pg_advisory_xact_lock(hashtext(campaign.owner_id::text||':'||campaign.plan_key)::bigint);
   if (select count(*) from public.ad_campaigns c where c.owner_id=campaign.owner_id and c.plan_key=campaign.plan_key and c.id<>campaign.id and (c.status='approved' and (c.ends_at is null or c.ends_at>now()) or c.status='suspended' and c.paid_at is not null and c.ends_at>now()))>=plan.max_campaigns then raise exception 'Simultaneous campaign limit reached';end if;
  end if;
 end if;
 if p_action='reserve_checkout' then
  if not coalesce((select payments_enabled from public.ad_settings),false) then raise exception 'Payments disabled';end if;
  select * into campaign from public.ad_campaigns where id=(p_payload->>'id')::uuid and owner_id=uid and status='approved' and paid_at is null;
  if campaign.plan_key='professional' then
   perform pg_advisory_xact_lock(hashtext(uid::text||':professional')::bigint);
   select a.* into attempt from public.ad_payment_attempts a join public.ad_campaigns c on c.id=a.campaign_id where a.owner_id=uid and c.plan_key='professional' and a.status in ('creating','open','processing') and a.expires_at>now() order by a.created_at limit 1;
   if attempt.id is not null then return to_jsonb(attempt);end if;
  end if;
 end if;
 if p_action='feed' then return coalesce((select jsonb_agg(to_jsonb(x) order by x.feed_priority desc,x.created_at) from (
  select c.id,c.business,c.title,c.body,c.target_url,c.image_paths,c.ends_at,p.feed_priority,c.created_at from public.ad_campaigns c join public.ad_plans p on p.key=c.plan_key
  where c.status='approved' and (c.paid_at is not null or c.free_activated_at is not null) and c.starts_at<=now() and c.ends_at>now() and (c.zone='national' or c.zone=p_payload->>'zone')
   and 'home_feed'=any(p.placements) and (select enabled from public.ad_settings)
   and not exists(select 1 from public.admin_account_controls controls where controls.user_id=c.owner_id and controls.suspended)
   and not exists(select 1 from auth.users u where u.id=c.owner_id and u.banned_until>now()) order by p.feed_priority desc,random() limit 2) x),'[]');end if;
 if p_action='schedule' and exists(select 1 from public.ad_campaigns where id=(p_payload->>'id')::uuid and entitlement_id is not null) then raise exception 'Professional campaigns share a common period; individual rescheduling is unavailable';end if;
 result:=public.myevent_ads_v2(p_action,p_payload);
 if p_action='review' and p_payload->>'status'='approved' and campaign.plan_key='professional' then perform public.myevent_ads_attach_pro(campaign.owner_id);end if;
 if p_action='mine' then return coalesce((select jsonb_agg(item.value||case when item.value->>'plan_key'='professional' then jsonb_build_object('daily_stats',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from public.ad_daily_stats d where d.campaign_id=(item.value->>'id')::uuid),'[]')) else '{}'::jsonb end) from jsonb_array_elements(result) item),'[]');end if;
 return result;
end $$;
revoke all on function public.myevent_ads(text,jsonb) from public,anon;
grant execute on function public.myevent_ads(text,jsonb) to authenticated;
do $$ begin if to_regprocedure('public.myevent_ads_paid_v2(uuid,text,integer,text)') is null then alter function public.myevent_ads_paid(uuid,text,integer,text) rename to myevent_ads_paid_v2;end if;end $$;
revoke all on function public.myevent_ads_paid_v2(uuid,text,integer,text) from public,anon,authenticated,service_role;
create or replace function public.myevent_ads_paid(p_id uuid,p_session text,p_amount integer,p_currency text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare result boolean;campaign public.ad_campaigns;entitlement public.ad_entitlements;
begin
 result:=public.myevent_ads_paid_v2(p_id,p_session,p_amount,p_currency);
 select * into campaign from public.ad_campaigns where id=p_id for update;
 if campaign.plan_key='professional' then
  perform pg_advisory_xact_lock(hashtext(campaign.owner_id::text||':professional')::bigint);
  insert into public.ad_entitlements(owner_id,plan_key,payment_session,price_cents,max_campaigns,starts_at,ends_at) values(campaign.owner_id,'professional',p_session,p_amount,3,campaign.starts_at,campaign.ends_at) on conflict(payment_session) do nothing;
  select * into entitlement from public.ad_entitlements where payment_session=p_session;
  update public.ad_campaigns set entitlement_id=entitlement.id where id=p_id;
  perform public.myevent_ads_attach_pro(campaign.owner_id);
 end if;return result;
end $$;
revoke all on function public.myevent_ads_paid(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.myevent_ads_paid(uuid,text,integer,text) to service_role;
do $$ begin if to_regprocedure('public.myevent_ads_count_once_v2(uuid,text,text)') is null then alter function public.myevent_ads_count_once(uuid,text,text) rename to myevent_ads_count_once_v2;end if;end $$;
revoke all on function public.myevent_ads_count_once_v2(uuid,text,text) from public,anon,authenticated,service_role;
create or replace function public.myevent_ads_count_once(p_id uuid,p_kind text,p_receipt text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$ declare result boolean;begin
 result:=public.myevent_ads_count_once_v2(p_id,p_kind,p_receipt);
 if result then insert into public.ad_daily_stats(campaign_id,day,impressions,clicks) values(p_id,current_date,case when p_kind='impression' then 1 else 0 end,case when p_kind='click' then 1 else 0 end) on conflict(campaign_id,day) do update set impressions=ad_daily_stats.impressions+excluded.impressions,clicks=ad_daily_stats.clicks+excluded.clicks;end if;
 return result;
end $$;
revoke all on function public.myevent_ads_count_once(uuid,text,text) from public,anon,authenticated;
grant execute on function public.myevent_ads_count_once(uuid,text,text) to service_role;
commit;
