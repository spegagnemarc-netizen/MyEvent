-- TEST ONLY: extension of V1 already installed; not a production migration.
begin;
DO $$ begin if (select current_setting('app.settings.project_ref',true)) is distinct from 'ahyyknfjsielnqyoxqgh' then raise exception 'Explicit TEST target required'; end if; end $$;
create or replace function registration_private.validate(p jsonb) returns void language plpgsql set search_path='' as $$
declare d date; item text;
begin
 if coalesce(p->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p->>'email')>254 then raise exception 'Adresse e-mail invalide'; end if;
 if coalesce(p->>'phone','')<>'' or p->>'primary_method' is distinct from 'email' then raise exception 'Inscription par e-mail uniquement'; end if;
 if jsonb_typeof(p)<>'object' or p is null then raise exception 'Fiche invalide'; end if;
 if length(trim(coalesce(p->>'first_name','')))>80 or length(trim(coalesce(p->>'city','')))>100 or coalesce(p->>'last_name','')<>'' then raise exception 'Prénom ou ville trop longs ; identité civile non demandée'; end if;
 if coalesce(p->>'username','') !~ '^[a-zA-Z0-9_]{3,30}$' then raise exception 'Pseudo : 3 à 30 lettres sans accent, chiffres ou _'; end if;
 if coalesce(p->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Date de naissance invalide'; end if;
 d:=(p->>'birth_date')::date;
 if d>current_date or d<current_date-interval '120 years' then raise exception 'Date de naissance invalide'; end if;
 if p->'terms' is distinct from 'true'::jsonb or p->'privacy' is distinct from 'true'::jsonb then raise exception 'Acceptation CGU et lecture confidentialité requises'; end if;
 if coalesce(p->>'visibility','') not in ('private','members') or jsonb_typeof(p->'marketing') is distinct from 'boolean' then raise exception 'Préférences invalides'; end if;
 if length(coalesce(p->>'bio',''))>500 or jsonb_typeof(p->'interests') is distinct from 'array' or jsonb_array_length(p->'interests')>10 then raise exception 'Présentation : 500 caractères ; 10 intérêts maximum'; end if;
 for item in select jsonb_array_elements_text(p->'interests') loop
  if length(trim(item)) not between 1 and 40 then raise exception 'Centre d’intérêt invalide'; end if;
 end loop;
end $$;
create or replace function registration_private.save(uid uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform registration_private.validate(p);
 insert into registration_private.details(user_id,first_name,last_name,birth_date,city,expected_email,expected_phone,primary_method,bio,interests,visibility,marketing,terms_version,privacy_version)
 values(uid,trim(p->>'first_name'),trim(p->>'last_name'),(p->>'birth_date')::date,trim(p->>'city'),lower(trim(p->>'email')),p->>'phone',p->>'primary_method',coalesce(p->>'bio',''),array(select jsonb_array_elements_text(p->'interests')),p->>'visibility',(p->>'marketing')::boolean,'2026-11-03-test-v2','2026-11-03-test-v2')
 on conflict(user_id) do update set first_name=excluded.first_name,birth_date=excluded.birth_date,city=excluded.city,expected_email=excluded.expected_email,primary_method=excluded.primary_method,bio=excluded.bio,interests=excluded.interests,visibility=excluded.visibility,marketing=excluded.marketing,terms_version=excluded.terms_version,privacy_version=excluded.privacy_version,updated_at=now();
 insert into public.profiles(id,username,display_name) values(uid,lower(p->>'username'),lower(p->>'username'))
 on conflict(id) do update set username=excluded.username,display_name=coalesce(nullif(public.profiles.display_name,''),excluded.display_name);
 insert into registration_private.consent_events(user_id,marketing,terms_version,privacy_version) values(uid,(p->>'marketing')::boolean,'2026-11-03-test-v2','2026-11-03-test-v2');
end $$;
create or replace function public.registration_status_v1() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u auth.users; d registration_private.details; ev boolean; pv boolean;
begin
 if auth.uid() is null or not public.myevent_account_active() then raise exception 'Connexion requise'; end if;
 select * into u from auth.users where id=auth.uid();
 select * into d from registration_private.details where user_id=auth.uid();
 ev:=coalesce(u.email_confirmed_at is not null and nullif(u.email,'') is not null and lower(u.email)=d.expected_email,false);
 pv:=coalesce(u.phone_confirmed_at is not null and nullif(u.phone,'') is not null and u.phone=ltrim(d.expected_phone,'+'),false);
 return jsonb_build_object('legacy',coalesce(u.created_at<(select cutoff from registration_private.settings),false),'complete',ev and d.user_id is not null,'email_verified',ev,'phone_verified',pv,'email',u.email,'has_details',d.user_id is not null,'age_declared',d.birth_date is not null);
end $$;
create or replace function public.myevent_api_request_guard() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null and not public.myevent_account_active() then raise exception 'MYEVENT_ACCOUNT_SUSPENDED' using errcode='42501'; end if;
 -- An incomplete profile does not suspend an account. Adult-only activity checks remain unchanged.
end $$;
commit;
