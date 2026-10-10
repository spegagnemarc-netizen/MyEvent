-- V1 TEST ONLY. Apply manually to MyEvent-Admin-Test after authorization.
begin;
create table public.ad_plans(key text primary key,name text not null,price_cents integer check(price_cents between 50 and 10000000),duration_days integer check(duration_days between 1 and 365),currency text not null default 'eur' check(currency='eur'));
insert into public.ad_plans(key,name) values('discovery','Découverte'),('essential','Essentiel'),('visibility','Visibilité'),('premium','Premium');
create table public.ad_settings(id boolean primary key default true check(id),enabled boolean not null default false,spacing integer not null default 6 check(spacing between 5 and 30));
insert into public.ad_settings default values;
create table public.ad_campaigns(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),business text not null check(length(business) between 2 and 100),title text not null check(length(title) between 2 and 120),body text not null check(length(body) between 2 and 1000),target_url text not null check(target_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:443)?(/[^[:space:]]*)?$'),plan_key text not null references public.ad_plans(key),status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),review_reason text not null default '',price_cents integer,duration_days integer,payment_session text unique,paid_at timestamptz,ends_at timestamptz,impressions bigint not null default 0,clicks bigint not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.ad_audit(id bigint generated always as identity primary key,actor uuid not null,action text not null,campaign_id uuid,created_at timestamptz not null default now());
create table public.ad_external_revenue(id bigint generated always as identity primary key,provider text not null check(provider in ('AdSense','AdMob')),month date not null check(extract(day from month)=1),amount_cents integer not null check(amount_cents>=0),currency text not null default 'eur' check(currency='eur'),source text not null default 'manual' check(source='manual'),unique(provider,month));
alter table public.ad_plans enable row level security;
alter table public.ad_settings enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_audit enable row level security;
alter table public.ad_external_revenue enable row level security;
revoke all on public.ad_plans,public.ad_settings,public.ad_campaigns,public.ad_audit,public.ad_external_revenue from anon,authenticated;
-- Expose only checked RPCs. Owners cannot write approval, price, payment or counters.
create function public.myevent_ads(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); admin boolean; c public.ad_campaigns; plan public.ad_plans; result jsonb; next_status text; d integer; price integer;
begin
 if uid is null or not coalesce(public.myevent_account_active(),false) then raise exception 'Authentication required' using errcode='42501'; end if;
 admin:=coalesce(public.myevent_is_admin(),false);
 if p_action='catalog' then return jsonb_build_object('plans',(select jsonb_agg(to_jsonb(p)) from public.ad_plans p),'settings',(select to_jsonb(s) from public.ad_settings s)); end if;
 if p_action='mine' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ad_campaigns where owner_id=uid order by created_at desc limit 100) x),'[]'); end if;
 if p_action='feed' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,business,title,body,target_url from public.ad_campaigns where status='approved' and not exists(select 1 from public.admin_account_controls a where a.user_id=ad_campaigns.owner_id and a.suspended) and not exists(select 1 from auth.users u where u.id=ad_campaigns.owner_id and u.banned_until>now()) and paid_at is not null and ends_at>now() and (select enabled from public.ad_settings) order by created_at desc limit 2) x),'[]'); end if;
 if p_action='create' then
  if p_payload->>'professional' is distinct from 'on' then raise exception 'Professional declaration required';end if;
  perform pg_advisory_xact_lock(hashtext(uid::text)::bigint);
  if (select count(*) from public.ad_campaigns where owner_id=uid and created_at>now()-interval '1 day')>=10 then raise exception 'Daily campaign limit'; end if;
  insert into public.ad_campaigns(owner_id,business,title,body,target_url,plan_key) values(uid,p_payload->>'business',p_payload->>'title',p_payload->>'body',p_payload->>'target_url',p_payload->>'plan_key') returning * into c; return to_jsonb(c);
 end if;
 if p_action='quote' then
  select * into c from public.ad_campaigns where id=(p_payload->>'id')::uuid and owner_id=uid and status='approved' and paid_at is null;
  if c.id is null or c.price_cents is null or c.duration_days is null then raise exception 'Campaign not payable' using errcode='42501'; end if; return to_jsonb(c);
 end if;
 if not admin then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_action='admin_list' then return jsonb_build_object('campaigns',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ad_campaigns order by created_at desc limit 200) x),'[]'),'revenue_cents',(select coalesce(sum(price_cents),0) from public.ad_campaigns where paid_at is not null),'external',coalesce((select jsonb_agg(to_jsonb(e)) from public.ad_external_revenue e),'[]')); end if;
 if p_action='review' then
  next_status:=p_payload->>'status'; if next_status not in ('approved','rejected','suspended') then raise exception 'Invalid review'; end if;
  select * into c from public.ad_campaigns where id=(p_payload->>'id')::uuid for update;
  if c.id is null then raise exception 'Unknown campaign'; end if;
  if next_status='approved' then
   if c.status not in ('pending','suspended') then raise exception 'Invalid approval transition'; end if;
   if c.price_cents is null then select * into plan from public.ad_plans where key=c.plan_key; if plan.price_cents is null or plan.duration_days is null then raise exception 'Configure price and duration first'; end if; c.price_cents:=plan.price_cents;c.duration_days:=plan.duration_days; end if;
  end if;
  if next_status='rejected' and (c.status<>'pending' or c.paid_at is not null) then raise exception 'Only pending unpaid campaigns can be rejected'; end if;
  update public.ad_campaigns set status=next_status,review_reason=left(coalesce(p_payload->>'reason',''),500),price_cents=c.price_cents,duration_days=c.duration_days,updated_at=now() where id=c.id;
  insert into public.ad_audit(actor,action,campaign_id) values(uid,next_status,c.id);return jsonb_build_object('ok',true);
 end if;
 if p_action='plan' then
  price:=(p_payload->>'price_cents')::integer;d:=(p_payload->>'duration_days')::integer;
  if price is null or d is null then raise exception 'Missing price or duration'; end if;
  update public.ad_plans set price_cents=price,duration_days=d where key=p_payload->>'key';if not found then raise exception 'Unknown plan';end if;
  insert into public.ad_audit(actor,action) values(uid,'plan');return jsonb_build_object('ok',true);
 end if;
 if p_action='settings' then
  update public.ad_settings set enabled=coalesce((p_payload->>'enabled')::boolean,enabled),spacing=coalesce((p_payload->>'spacing')::integer,spacing);insert into public.ad_audit(actor,action) values(uid,'settings');return jsonb_build_object('ok',true);
 end if;
 if p_action='external_revenue' then
  insert into public.ad_external_revenue(provider,month,amount_cents) values(p_payload->>'provider',(p_payload->>'month')::date,(p_payload->>'amount_cents')::integer) on conflict(provider,month) do update set amount_cents=excluded.amount_cents;
  insert into public.ad_audit(actor,action) values(uid,'external_revenue');return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown action';
end $$;
revoke all on function public.myevent_ads(text,jsonb) from public,anon;
grant execute on function public.myevent_ads(text,jsonb) to authenticated;
create function public.myevent_ads_paid(p_id uuid,p_session text,p_amount integer,p_currency text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.ad_campaigns;
begin
 select * into c from public.ad_campaigns where id=p_id for update;
 if c.id is null or c.price_cents is distinct from p_amount or p_currency<>'eur' or p_session !~ '^cs_test_' then raise exception 'Payment mismatch';end if;
 if c.paid_at is not null then if c.payment_session=p_session then return true;else raise exception 'Already paid';end if;end if;
 if c.status not in ('approved','suspended') then raise exception 'Campaign not approved';end if;
 update public.ad_campaigns set payment_session=p_session,paid_at=now(),ends_at=now()+make_interval(days=>c.duration_days),updated_at=now() where id=p_id;return true;
end $$;
create function public.myevent_ads_count(p_id uuid,p_kind text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_kind not in ('impression','click') then raise exception 'Invalid metric';end if;
 update public.ad_campaigns set impressions=impressions+case when p_kind='impression' then 1 else 0 end,clicks=clicks+case when p_kind='click' then 1 else 0 end where id=p_id and status='approved' and not exists(select 1 from public.admin_account_controls a where a.user_id=ad_campaigns.owner_id and a.suspended) and not exists(select 1 from auth.users u where u.id=ad_campaigns.owner_id and u.banned_until>now()) and paid_at is not null and ends_at>now() and (select enabled from public.ad_settings);return found;
end $$;
revoke all on function public.myevent_ads_paid(uuid,text,integer,text),public.myevent_ads_count(uuid,text) from public,anon,authenticated;
grant execute on function public.myevent_ads_paid(uuid,text,integer,text),public.myevent_ads_count(uuid,text) to service_role;
commit;
