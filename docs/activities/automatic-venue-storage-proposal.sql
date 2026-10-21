-- PROPOSITION SEULEMENT — Supabase TEST ahyyknfjsielnqyoxqgh.
-- Non appliquée. Réutilise les contrôles de sauvegarde/visibilité existants.
-- Aucun catalogue partagé, aucune activation, aucune donnée existante modifiée.
begin;
create table activities_private.venue_sheets (
 activity_id uuid primary key references activities_private.activities(id),
 facts jsonb not null check(jsonb_typeof(facts)='object' and octet_length(facts::text)<=65536),
 updated_at timestamptz not null default now()
);
alter table activities_private.venue_sheets enable row level security;
revoke all on activities_private.venue_sheets from public,anon,authenticated;

create function activities_private.save_with_venue(p_id uuid,p_data jsonb,p_sheet jsonb,p_cover uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid; me uuid:=auth.uid();
begin
 if me is null or not activities_private.allowed() then raise exception 'Accès TEST non autorisé'; end if;
 if p_sheet is null or jsonb_typeof(p_sheet)<>'object' or octet_length(p_sheet::text)>65536 then raise exception 'Fiche invalide'; end if;
 -- Never persist a provider/organiser-supplied "verified" flag or an HTML response.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into p_sheet from jsonb_each(p_sheet)
 where key=any(array['id','name','address','city','lat','lon','description','phone','website','opening_hours','activity_hours','prices','booking_url','sources','source_url','source','retrieved_at','checked_at']);
 -- Save and sheet are one transaction; existing owner, capacity and quota checks apply.
 if p_cover is null then saved:=public.activities_save(p_id,p_data);
 else saved:=public.activities_save_with_cover(p_cover,p_id,p_data); end if;
 if not exists(select 1 from activities_private.activities where id=saved and organizer_id=me) then raise exception 'Organisateur non autorisé'; end if;
 insert into activities_private.venue_sheets(activity_id,facts) values(saved,p_sheet)
 on conflict(activity_id) do update set facts=excluded.facts,updated_at=now();
 return saved;
end $$;
revoke all on function activities_private.save_with_venue(uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function activities_private.save_with_venue(uuid,jsonb,jsonb,uuid) to authenticated;

create function activities_private.read_venue_sheet(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare detail jsonb;
begin
 if auth.uid() is null then return null; end if;
 detail:=public.activities_detail(p_id);
 if detail is null or detail->>'id' is distinct from p_id::text then return null; end if;
 -- Same readership as the existing activity; public establishment facts only.
 return (select facts from activities_private.venue_sheets where activity_id=p_id);
end $$;
revoke all on function activities_private.read_venue_sheet(uuid) from public,anon;
grant execute on function activities_private.read_venue_sheet(uuid) to authenticated;

create function public.activities_save_with_venue(p_id uuid,p_data jsonb,p_sheet jsonb,p_cover uuid default null)
returns uuid language sql set search_path='' as $$select activities_private.save_with_venue(p_id,p_data,p_sheet,p_cover)$$;
create function public.activities_venue_sheet(p_id uuid)
returns jsonb language sql stable set search_path='' as $$select activities_private.read_venue_sheet(p_id)$$;
revoke all on function public.activities_save_with_venue(uuid,jsonb,jsonb,uuid) from public,anon;
revoke all on function public.activities_venue_sheet(uuid) from public,anon;
grant execute on function public.activities_save_with_venue(uuid,jsonb,jsonb,uuid) to authenticated;
grant execute on function public.activities_venue_sheet(uuid) to authenticated;
commit;

-- Retour arrière : revenir au commit précédent. Conserver venue_sheets et ses
-- fonctions (inertes sans appel) pour préserver toute fiche déjà enregistrée.
-- Aucune suppression de table ni de donnée proposée.
