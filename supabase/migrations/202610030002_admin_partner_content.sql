-- Admin content catalogue V1. Apply AFTER 202610030001_platform_admin.sql.
create table if not exists public.admin_partner_content (
 id uuid primary key default gen_random_uuid(),
 provider text not null check (provider in ('getyourguide','ticketnetwork','fnac_spectacles')),
 kind text not null check (kind in ('city_widget','activity','availability')),
 title text not null check (char_length(title) between 1 and 160),
 city text not null default '',
 external_id text not null default '',
 affiliate_url text not null default '',
 campaign text not null default '',
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.admin_partner_content enable row level security;
revoke all on public.admin_partner_content from public, anon, authenticated;
create or replace function public.myevent_admin_partner_content_list()
returns setof public.admin_partner_content language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists (select 1 from public.platform_admins where user_id=auth.uid() and role='super_admin')
 then raise exception 'Accès refusé' using errcode='42501'; end if;
 return query select * from public.admin_partner_content order by created_at desc limit 250;
end $$;
revoke all on function public.myevent_admin_partner_content_list() from public, anon;
grant execute on function public.myevent_admin_partner_content_list() to authenticated;
create or replace function public.myevent_admin_partner_content_save(
 p_provider text,p_kind text,p_title text,p_city text default '',p_external_id text default '',
 p_affiliate_url text default '',p_campaign text default '',p_enabled boolean default false,p_id uuid default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists (select 1 from public.platform_admins where user_id=auth.uid() and role='super_admin')
 then raise exception 'Accès refusé' using errcode='42501'; end if;
 if p_provider not in ('getyourguide','ticketnetwork','fnac_spectacles') or p_kind not in ('city_widget','activity','availability')
 or length(trim(coalesce(p_title,''))) not between 1 and 160
 or length(coalesce(p_city,'')) > 120 or length(coalesce(p_external_id,'')) > 100
 or length(coalesce(p_campaign,'')) > 100 or length(coalesce(p_affiliate_url,'')) > 2048
 or (coalesce(p_affiliate_url,'') <> '' and p_affiliate_url !~ '^https://')
 then raise exception 'Contenu invalide' using errcode='22023'; end if;
 if p_id is null then
  insert into public.admin_partner_content(provider,kind,title,city,external_id,affiliate_url,campaign,enabled)
  values(p_provider,p_kind,trim(p_title),coalesce(p_city,''),coalesce(p_external_id,''),coalesce(p_affiliate_url,''),coalesce(p_campaign,''),coalesce(p_enabled,false)) returning id into v_id;
 else
  update public.admin_partner_content set provider=p_provider,kind=p_kind,title=trim(p_title),city=coalesce(p_city,''),
  external_id=coalesce(p_external_id,''),affiliate_url=coalesce(p_affiliate_url,''),campaign=coalesce(p_campaign,''),
  enabled=coalesce(p_enabled,false),updated_at=now() where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Contenu introuvable' using errcode='P0002'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.myevent_admin_partner_content_save(text,text,text,text,text,text,text,boolean,uuid) from public, anon;
grant execute on function public.myevent_admin_partner_content_save(text,text,text,text,text,text,text,boolean,uuid) to authenticated;
