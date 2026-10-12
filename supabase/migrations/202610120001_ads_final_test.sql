-- REVIEW ONLY: do not apply until the Dashboard project is confirmed as MyEvent-Admin-Test.
-- The operator must set myevent.target_project_ref to the verified reference in this session.
begin;
do $$ begin
 if current_setting('myevent.target_project_ref',true) is distinct from 'ahyyknfjsielnqyoxqgh' then
  raise exception 'Verified MyEvent-Admin-Test project required';
 end if;
 if to_regprocedure('public.myevent_ads(text,jsonb)') is null then raise exception 'Ads V1 migration required';end if;
end $$;
alter table public.ad_plans add column if not exists placements text[] not null default array['home_feed'];
alter table public.ad_plans add column if not exists max_visuals integer not null default 1 check(max_visuals between 1 and 4);
alter table public.ad_plans add column if not exists geography text not null default 'department' check(geography in ('department','national'));
alter table public.ad_plans add column if not exists renewal text not null default 'manual' check(renewal='manual');
alter table public.ad_plans add column if not exists active boolean not null default true;
alter table public.ad_plans drop constraint if exists ad_plans_price_cents_check;
alter table public.ad_plans drop constraint if exists ad_launch_price;
alter table public.ad_plans add constraint ad_launch_price check(price_cents is null or (key='welcome' and price_cents=0) or (key<>'welcome' and price_cents between 50 and 10000000));
insert into public.ad_plans(key,name,price_cents,duration_days) values
 ('welcome','Bienvenue',0,15),('discovery','Découverte',199,7),('visibility','Visibilité',499,15),('premium','Premium',999,30),('professional','Professionnel',1999,30)
 on conflict(key) do update set price_cents=coalesce(ad_plans.price_cents,excluded.price_cents),duration_days=coalesce(ad_plans.duration_days,excluded.duration_days);
-- Preserve historical campaigns referring to Essentiel, but exclude it from new sales.
update public.ad_plans set active=false where key='essential';
alter table public.ad_settings add column if not exists payments_enabled boolean not null default false;
alter table public.ad_campaigns add column if not exists image_paths text[] not null default '{}';
alter table public.ad_campaigns add column if not exists zone text not null default 'national';
alter table public.ad_campaigns add column if not exists starts_at timestamptz;
alter table public.ad_campaigns add column if not exists free_activated_at timestamptz;
create table if not exists public.ad_verified_advertisers(owner_id uuid primary key references auth.users(id),advertiser_key text not null unique check(advertiser_key ~ '^[0-9]{9}$'),verified_by uuid not null references auth.users(id),reason text not null,verified_at timestamptz not null default now());
create table if not exists public.ad_welcome_claims(owner_id uuid primary key references auth.users(id),campaign_id uuid not null unique references public.ad_campaigns(id),advertiser_key text not null unique,claimed_at timestamptz not null default now());
alter table public.ad_verified_advertisers enable row level security;
alter table public.ad_welcome_claims enable row level security;
revoke all on public.ad_verified_advertisers,public.ad_welcome_claims from public,anon,authenticated;
create table if not exists public.ad_payment_attempts(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.ad_campaigns(id),
 owner_id uuid not null references auth.users(id),amount_cents integer not null,
 session_id text unique,checkout_url text,expires_at timestamptz not null default now()+interval '31 minutes',
 status text not null default 'creating' check(status in ('creating','open','processing','paid','failed','expired')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index if not exists ad_one_open_payment on public.ad_payment_attempts(campaign_id) where status in ('creating','open','processing');
alter table public.ad_payment_attempts enable row level security;
revoke all on public.ad_payment_attempts from public,anon,authenticated;
-- New media is private. No changes to event-media/story-media or any other bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ad-media','ad-media',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='ad-media' and (public or file_size_limit is distinct from 2097152 or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp']::text[])) then
  raise exception 'Existing ad-media bucket differs: manual review required';
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ad_media_owner_insert') then
  execute 'create policy ad_media_owner_insert on storage.objects for insert to authenticated with check(bucket_id=''ad-media'' and split_part(name,''/'',1)=auth.uid()::text and public.myevent_account_active())';
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ad_media_author_admin_read') then
  execute 'create policy ad_media_author_admin_read on storage.objects for select to authenticated using(bucket_id=''ad-media'' and public.myevent_account_active() and (split_part(name,''/'',1)=auth.uid()::text or public.myevent_is_admin()))';
 end if;
end $$;
-- Preserve checked V1 operations, but prevent clients bypassing the new validation wrapper.
do $$ begin
 if to_regprocedure('public.myevent_ads_v1(text,jsonb)') is null then alter function public.myevent_ads(text,jsonb) rename to myevent_ads_v1;end if;
end $$;
revoke all on function public.myevent_ads_v1(text,jsonb) from public,anon,authenticated;
create or replace function public.myevent_ads(p_action text,p_payload jsonb default '{}') returns jsonb
 language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();c public.ad_campaigns;plan public.ad_plans;paths text[];z text;result jsonb;a public.ad_payment_attempts;
begin
 if uid is null or not coalesce(public.myevent_account_active(),false) then raise exception 'Authentication required' using errcode='42501';end if;
 if p_action='catalog' then return jsonb_build_object('plans',(select jsonb_agg(to_jsonb(p) order by p.price_cents) from public.ad_plans p where p.active),'settings',(select to_jsonb(s) from public.ad_settings s),'advertiser_verified',exists(select 1 from public.ad_verified_advertisers where owner_id=uid),'welcome_used',exists(select 1 from public.ad_welcome_claims where owner_id=uid));end if;
 if p_action='verify_advertiser' then
  if not coalesce(public.myevent_is_admin(),false) then raise exception 'Administrator required' using errcode='42501';end if;
  if coalesce(p_payload->>'advertiser_key','') !~ '^[0-9]{9}$' then raise exception 'Verified SIREN required';end if;
  if length(trim(coalesce(p_payload->>'reason','')))<3 then raise exception 'Verification reason required';end if;
  insert into public.ad_verified_advertisers(owner_id,advertiser_key,verified_by,reason) values((p_payload->>'owner_id')::uuid,p_payload->>'advertiser_key',uid,left(p_payload->>'reason',500)) on conflict(owner_id) do update set advertiser_key=excluded.advertiser_key,verified_by=uid,reason=excluded.reason,verified_at=now();
  insert into public.ad_audit(actor,action) values(uid,'advertiser_verified');return jsonb_build_object('ok',true);
 end if;
 if p_action='create' or p_action='update' then
  select * into plan from public.ad_plans where key=p_payload->>'plan_key' and active;if plan.key is null then raise exception 'Unknown plan';end if;
  if plan.key='welcome' and exists(select 1 from public.ad_welcome_claims where owner_id=uid) then raise exception 'Welcome already used';end if;
  select coalesce(array_agg(value),'{}') into paths from jsonb_array_elements_text(coalesce(p_payload->'image_paths','[]'));
  z:=coalesce(p_payload->>'zone','');
  if z !~ '^(national|[0-9]{2,3}|2A|2B)$' or (z='national' and plan.geography<>'national') then raise exception 'Zone incompatible with offer';end if;
  if cardinality(paths)<1 or cardinality(paths)>plan.max_visuals then raise exception 'Invalid number of images';end if;
  if exists(select 1 from unnest(paths) path where path !~ ('^'||uid::text||'/[a-f0-9-]+\.(jpg|png|webp)$') or not exists(select 1 from storage.objects o where o.bucket_id='ad-media' and o.name=path)) then raise exception 'Image not owned or missing';end if;
  if p_action='create' then result:=public.myevent_ads_v1('create',p_payload);c.id:=(result->>'id')::uuid;
  else
   select * into c from public.ad_campaigns where id=(p_payload->>'id')::uuid and owner_id=uid for update;
   if c.id is null or c.status not in ('pending','rejected') or c.paid_at is not null then raise exception 'Only your pending or rejected unpaid campaigns can be edited' using errcode='42501';end if;
   if p_payload->>'professional' is distinct from 'on' then raise exception 'Professional declaration required';end if;
   update public.ad_campaigns set business=p_payload->>'business',title=p_payload->>'title',body=p_payload->>'body',target_url=p_payload->>'target_url',plan_key=plan.key,status='pending',review_reason='',price_cents=null,duration_days=null,updated_at=now() where id=c.id;
  end if;
  update public.ad_campaigns set image_paths=paths,zone=z where id=c.id returning * into c;
  insert into public.ad_audit(actor,action,campaign_id) values(uid,p_action,c.id);return to_jsonb(c);
 end if;
 if p_action='feed' then
  z:=coalesce(p_payload->>'zone','');
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select campaign.id,campaign.business,campaign.title,campaign.body,campaign.target_url,campaign.image_paths,campaign.ends_at from public.ad_campaigns campaign join public.ad_plans p on p.key=campaign.plan_key
   where campaign.status='approved' and (campaign.paid_at is not null or campaign.free_activated_at is not null) and campaign.starts_at<=now() and campaign.ends_at>now() and (campaign.zone='national' or campaign.zone=z)
    and 'home_feed'=any(p.placements) and (select enabled from public.ad_settings)
    and not exists(select 1 from public.admin_account_controls controls where controls.user_id=campaign.owner_id and controls.suspended)
    and not exists(select 1 from auth.users u where u.id=campaign.owner_id and u.banned_until>now()) order by campaign.created_at desc limit 2) x),'[]');
 end if;
 if p_action='history' then return coalesce((select jsonb_agg(to_jsonb(attempt) - 'checkout_url') from public.ad_payment_attempts attempt where attempt.owner_id=uid),'[]');end if;
 if p_action='reserve_checkout' then
  if not (select payments_enabled from public.ad_settings) then raise exception 'Payments disabled pending commercial approval' using errcode='42501';end if;
  result:=public.myevent_ads_v1('quote',p_payload);select * into c from public.ad_campaigns where id=(result->>'id')::uuid for update;
  if c.plan_key='welcome' or c.price_cents<=0 then raise exception 'No Stripe checkout for Welcome';end if;
  update public.ad_payment_attempts set status='expired',updated_at=now() where campaign_id=c.id and status in ('creating','open') and expires_at<=now();
  select * into a from public.ad_payment_attempts where campaign_id=c.id and status in ('creating','open','processing');
  if a.id is null then insert into public.ad_payment_attempts(campaign_id,owner_id,amount_cents) values(c.id,uid,c.price_cents) returning * into a;end if;
  return to_jsonb(a);
 end if;
 if p_action='renew' then
  select * into c from public.ad_campaigns where id=(p_payload->>'id')::uuid and owner_id=uid;
  if c.id is null or c.paid_at is null or c.ends_at>now() then raise exception 'Only your expired campaign can be renewed' using errcode='42501';end if;
  return public.myevent_ads('create',jsonb_build_object('professional','on','business',c.business,'title',c.title,'body',c.body,'target_url',c.target_url,'plan_key',c.plan_key,'image_paths',c.image_paths,'zone',c.zone));
 end if;
 if p_action in ('plan','settings','admin_list','audit','schedule') and not coalesce(public.myevent_is_admin(),false) then raise exception 'Administrator required' using errcode='42501';end if;
 if p_action='schedule' then
  select * into c from public.ad_campaigns where id=(p_payload->>'id')::uuid and paid_at is not null for update;
  if c.id is null or (p_payload->>'starts_at')::timestamptz<now() then raise exception 'Paid campaign and future start required';end if;
  update public.ad_campaigns set starts_at=(p_payload->>'starts_at')::timestamptz,ends_at=(p_payload->>'starts_at')::timestamptz+make_interval(days=>c.duration_days),updated_at=now() where id=c.id;
  insert into public.ad_audit(actor,action,campaign_id) values(uid,'schedule',c.id);return jsonb_build_object('ok',true);
 end if;
 if p_action='audit' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ad_audit order by created_at desc limit 200) x),'[]');end if;
 if p_action='plan' then
  select * into plan from public.ad_plans where key=p_payload->>'key';
  p_payload:=jsonb_build_object('geography',plan.geography,'max_visuals',plan.max_visuals)||p_payload;
  if coalesce(p_payload->>'geography','department') not in ('department','national') or (p_payload->>'max_visuals')::integer not between 1 and 4 then raise exception 'Invalid offer';end if;
  result:=public.myevent_ads_v1('plan',p_payload);
  update public.ad_plans set geography=p_payload->>'geography',max_visuals=(p_payload->>'max_visuals')::integer where key=p_payload->>'key';return result;
 end if;
 if p_action='settings' then
  if coalesce((p_payload->>'payments_enabled')::boolean,false) and exists(select 1 from public.ad_plans where active and (price_cents is null or duration_days is null)) then raise exception 'Configure five approved offers first';end if;
  result:=public.myevent_ads_v1('settings',p_payload);update public.ad_settings set payments_enabled=coalesce((p_payload->>'payments_enabled')::boolean,payments_enabled);return result;
 end if;
 if p_action='admin_list' then result:=public.myevent_ads_v1(p_action,p_payload);return result||jsonb_build_object('payments',coalesce((select jsonb_agg(to_jsonb(attempt) - 'checkout_url') from public.ad_payment_attempts attempt),'[]'),'verified_advertisers',coalesce((select jsonb_agg(owner_id) from public.ad_verified_advertisers),'[]'));end if;
 if p_action='review' and p_payload->>'status'='approved' then
  select * into c from public.ad_campaigns where id=(p_payload->>'id')::uuid for update;
  if c.plan_key='welcome' then
   if not coalesce(public.myevent_is_admin(),false) then raise exception 'Administrator required' using errcode='42501';end if;
   if c.status not in ('pending','suspended') or not exists(select 1 from public.ad_verified_advertisers where owner_id=c.owner_id) then raise exception 'Verified advertiser and moderation required';end if;
   insert into public.ad_welcome_claims(owner_id,campaign_id,advertiser_key) select c.owner_id,c.id,verified.advertiser_key from public.ad_verified_advertisers verified where verified.owner_id=c.owner_id on conflict(owner_id) do nothing;
   if not exists(select 1 from public.ad_welcome_claims where owner_id=c.owner_id and campaign_id=c.id) then raise exception 'Welcome already used';end if;
   select * into plan from public.ad_plans where key='welcome';
   update public.ad_campaigns set status='approved',price_cents=0,duration_days=coalesce(c.duration_days,plan.duration_days),free_activated_at=coalesce(c.free_activated_at,now()),starts_at=coalesce(c.starts_at,now()),ends_at=coalesce(c.ends_at,now()+make_interval(days=>plan.duration_days)),review_reason=left(coalesce(p_payload->>'reason',''),500),updated_at=now() where id=c.id;
   insert into public.ad_audit(actor,action,campaign_id) values(uid,'welcome_approved',c.id);return jsonb_build_object('ok',true);
  end if;
 end if;
 if p_action='review' and p_payload->>'status'='rejected' and length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Refusal reason required';end if;
 return public.myevent_ads_v1(p_action,p_payload);
end $$;
revoke all on function public.myevent_ads(text,jsonb) from public,anon;
grant execute on function public.myevent_ads(text,jsonb) to authenticated;
-- This checked service RPC is called only after server-side authentication or a signed Stripe event.
create or replace function public.myevent_ads_checkout_saved(p_attempt uuid,p_session text,p_url text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if p_session !~ '^cs_test_' or p_url !~ '^https://checkout\.stripe\.com/' then raise exception 'TEST session required';end if;
 update public.ad_payment_attempts set session_id=p_session,checkout_url=p_url,status='open',updated_at=now() where id=p_attempt and status in ('creating','open') and (session_id is null or session_id=p_session);if not found then raise exception 'Invalid checkout attempt';end if;return true;
end $$;
create or replace function public.myevent_ads_payment_event(p_session text,p_state text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if p_state not in ('expired','failed','processing') then raise exception 'Invalid payment state';end if;
 update public.ad_payment_attempts set status=p_state,updated_at=now() where session_id=p_session and status in ('creating','open','processing');return found;
end $$;
do $$ begin if to_regprocedure('public.myevent_ads_paid_v1(uuid,text,integer,text)') is null then alter function public.myevent_ads_paid(uuid,text,integer,text) rename to myevent_ads_paid_v1;end if;end $$;
revoke all on function public.myevent_ads_paid_v1(uuid,text,integer,text) from public,anon,authenticated,service_role;
create or replace function public.myevent_ads_paid(p_id uuid,p_session text,p_amount integer,p_currency text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$ declare result boolean;a public.ad_payment_attempts;begin
 select * into a from public.ad_payment_attempts where campaign_id=p_id and session_id=p_session for update;
 if a.id is null or a.amount_cents is distinct from p_amount then raise exception 'Unregistered payment';end if;
 result:=public.myevent_ads_paid_v1(p_id,p_session,p_amount,p_currency);
 update public.ad_payment_attempts set status='paid',updated_at=now() where id=a.id;
 update public.ad_campaigns set starts_at=coalesce(starts_at,paid_at) where id=p_id;return result;
end $$;
update public.ad_campaigns set starts_at=paid_at where paid_at is not null and starts_at is null;
revoke all on function public.myevent_ads_checkout_saved(uuid,text,text),public.myevent_ads_payment_event(text,text),public.myevent_ads_paid(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.myevent_ads_checkout_saved(uuid,text,text),public.myevent_ads_payment_event(text,text),public.myevent_ads_paid(uuid,text,integer,text) to service_role;
-- Aggregate counters with a short-lived pseudonymous deduplication key, never a user/IP/device profile.
create table if not exists public.ad_metric_receipts(campaign_id uuid not null references public.ad_campaigns(id),kind text not null,receipt text not null,created_at timestamptz not null default now(),primary key(campaign_id,kind,receipt));
alter table public.ad_metric_receipts enable row level security;
revoke all on public.ad_metric_receipts from public,anon,authenticated;
create or replace function public.myevent_ads_count_once(p_id uuid,p_kind text,p_receipt text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$ declare inserted integer;begin
 if p_kind not in ('impression','click') or p_receipt !~ '^[a-f0-9]{64}$' then raise exception 'Invalid metric';end if;
 if not exists(select 1 from public.ad_campaigns where id=p_id and starts_at<=now() and ends_at>now()) then return false;end if;
 delete from public.ad_metric_receipts where created_at<now()-interval '2 days';
 insert into public.ad_metric_receipts(campaign_id,kind,receipt) values(p_id,p_kind,p_receipt) on conflict do nothing;
 get diagnostics inserted=row_count;if inserted=0 then return false;end if;
 if exists(select 1 from public.ad_campaigns where id=p_id and free_activated_at is not null) then
  update public.ad_campaigns set impressions=impressions+case when p_kind='impression' then 1 else 0 end,clicks=clicks+case when p_kind='click' then 1 else 0 end
   where id=p_id and status='approved' and starts_at<=now() and ends_at>now() and (select enabled from public.ad_settings)
    and not exists(select 1 from public.admin_account_controls controls where controls.user_id=ad_campaigns.owner_id and controls.suspended)
    and not exists(select 1 from auth.users u where u.id=ad_campaigns.owner_id and u.banned_until>now());return found;
 end if;
 return public.myevent_ads_count(p_id,p_kind);
end $$;
revoke all on function public.myevent_ads_count_once(uuid,text,text) from public,anon,authenticated;
grant execute on function public.myevent_ads_count_once(uuid,text,text) to service_role;
commit;
