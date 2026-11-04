-- Target: nxxvadbliinhvkirqkkl. Additive installation, not the TEST upgrade.
-- No writes to existing users, profiles, adult_access, RLS or Auth settings.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if current_setting('app.settings.project_ref',true) is distinct from 'nxxvadbliinhvkirqkkl' then raise exception 'Confirm exact production project'; end if;
 if exists(select 1 from pg_namespace where nspname='registration_private') then raise exception 'Already installed: review before retry'; end if;
 if to_regprocedure('activities_private.adult_eligible(uuid)') is null or to_regprocedure('activities_private.blocked(uuid,uuid)') is null then raise exception 'Existing safety helpers required'; end if;
end $$;
create schema registration_private;
revoke all on schema registration_private from public,anon,authenticated;
create table registration_private.details(
 user_id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null default '',birth_date date not null,city text not null default '',
 expected_email text not null,bio text not null default '',interests text[] not null default '{}',
 visibility text not null default 'private' check(visibility in ('private','members')),
 marketing boolean not null default false,terms_version text not null,privacy_version text not null,
 accepted_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table registration_private.consent_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 marketing boolean not null,terms_version text not null,privacy_version text not null,
 recorded_at timestamptz not null default now()
);
create table registration_private.pending(
 token uuid primary key default gen_random_uuid(),payload jsonb not null,
 expires_at timestamptz not null default now()+interval '15 minutes'
);
create index registration_pending_expiry on registration_private.pending(expires_at);
alter table registration_private.details enable row level security;
alter table registration_private.consent_events enable row level security;
alter table registration_private.pending enable row level security;
revoke all on all tables in schema registration_private from public,anon,authenticated;
revoke all on all sequences in schema registration_private from public,anon,authenticated;

create function registration_private.validate(p jsonb) returns void language plpgsql set search_path='' as $$
declare d date; item jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>8192 then raise exception 'Fiche invalide'; end if;
 if coalesce(p->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p->>'email')>254 then raise exception 'Adresse e-mail invalide'; end if;
 if coalesce(p->>'phone','')<>'' or coalesce(p->>'last_name','')<>'' or p->>'primary_method' is distinct from 'email' then raise exception 'Identité civile et téléphone non demandés'; end if;
 if length(trim(coalesce(p->>'first_name','')))>80 or length(trim(coalesce(p->>'city','')))>100 then raise exception 'Prénom ou ville trop longs'; end if;
 if coalesce(p->>'username','') !~ '^[a-zA-Z0-9_]{3,30}$' then raise exception 'Pseudo : 3 à 30 lettres, chiffres ou _'; end if;
 if coalesce(p->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Date de naissance invalide'; end if;
 d:=(p->>'birth_date')::date;
 if d>current_date or d<current_date-interval '120 years' then raise exception 'Date de naissance invalide'; end if;
 if p->'terms' is distinct from 'true'::jsonb or p->'privacy' is distinct from 'true'::jsonb then raise exception 'Acceptation des conditions et lecture confidentialité requises'; end if;
 if coalesce(p->>'visibility','') not in ('private','members') or jsonb_typeof(p->'marketing') is distinct from 'boolean' then raise exception 'Préférences invalides'; end if;
 if length(coalesce(p->>'bio',''))>500 or jsonb_typeof(p->'interests') is distinct from 'array' then raise exception 'Présentation ou intérêts invalides'; end if;
 if jsonb_array_length(p->'interests')>10 then raise exception '10 intérêts maximum'; end if;
 for item in select value from jsonb_array_elements(p->'interests') loop
  if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 40 then raise exception 'Centre d’intérêt invalide'; end if;
 end loop;
end $$;

create function registration_private.save(uid uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform registration_private.validate(p);
 perform pg_advisory_xact_lock(hashtextextended('registration.username.'||lower(p->>'username'),0));
 if exists(select 1 from public.profiles where lower(username)=lower(p->>'username') and id<>uid) then raise exception 'Pseudonyme indisponible' using errcode='23505'; end if;
 insert into registration_private.details(user_id,first_name,birth_date,city,expected_email,bio,interests,visibility,marketing,terms_version,privacy_version)
 values(uid,trim(coalesce(p->>'first_name','')),(p->>'birth_date')::date,trim(coalesce(p->>'city','')),lower(trim(p->>'email')),coalesce(p->>'bio',''),array(select jsonb_array_elements_text(p->'interests')),p->>'visibility',(p->>'marketing')::boolean,'2026-11-04-v1','2026-11-04-v1')
 on conflict(user_id) do update set first_name=excluded.first_name,birth_date=excluded.birth_date,city=excluded.city,expected_email=excluded.expected_email,bio=excluded.bio,interests=excluded.interests,visibility=excluded.visibility,marketing=excluded.marketing,terms_version=excluded.terms_version,privacy_version=excluded.privacy_version,updated_at=now();
 insert into public.profiles(id,username,display_name) values(uid,lower(p->>'username'),lower(p->>'username'))
 on conflict(id) do update set username=excluded.username;
 insert into registration_private.consent_events(user_id,marketing,terms_version,privacy_version) values(uid,(p->>'marketing')::boolean,'2026-11-04-v1','2026-11-04-v1');
end $$;

create function public.registration_prepare_v1(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; clean jsonb;
begin
 perform registration_private.validate(p);
 perform pg_advisory_xact_lock(hashtextextended('registration.prepare',0));
 delete from registration_private.pending where expires_at<=now();
 if (select count(*) from registration_private.pending)>=1000 then raise exception 'Inscriptions momentanément indisponibles'; end if;
 select jsonb_object_agg(key,value) into clean from jsonb_each(p) where key=any(array['first_name','birth_date','city','username','email','primary_method','bio','interests','visibility','terms','privacy','marketing']);
 insert into registration_private.pending(payload) values(clean) returning token into result;
 return result;
end $$;

create function registration_private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;
begin
 if new.raw_user_meta_data ? 'registration_v1' then
  if jsonb_typeof(new.raw_user_meta_data->'registration_v1') is distinct from 'string' then raise exception 'Référence de fiche invalide'; end if;
  delete from registration_private.pending where token=(new.raw_user_meta_data->>'registration_v1')::uuid and expires_at>now() returning payload into p;
  if p is null then raise exception 'Fiche expirée : recommencez l’inscription'; end if;
  if lower(coalesce(new.email,''))<>lower(p->>'email') then raise exception 'Adresse incohérente'; end if;
  perform registration_private.save(new.id,p);
  update auth.users set raw_user_meta_data=raw_user_meta_data-'registration_v1' where id=new.id;
 end if;
 return new;
end $$;
create trigger registration_signup_v1 after insert on auth.users for each row execute function registration_private.on_signup();

create function public.registration_self_v1() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.myevent_account_active() then raise exception 'Connexion requise'; end if;
 return (select (to_jsonb(d)-'user_id')||jsonb_build_object('username',(select username from public.profiles where id=d.user_id)) from registration_private.details d where user_id=auth.uid());
end $$;
create function public.registration_status_v1() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u auth.users; d registration_private.details; ev boolean;
begin
 if auth.uid() is null or not public.myevent_account_active() then raise exception 'Connexion requise'; end if;
 select * into u from auth.users where id=auth.uid();
 select * into d from registration_private.details where user_id=auth.uid();
 ev:=u.email_confirmed_at is not null and nullif(u.email,'') is not null;
 return jsonb_build_object('complete',coalesce(ev,false) and d.user_id is not null and lower(u.email)=d.expected_email,'email_verified',coalesce(ev,false),'phone_verified',false,'email',u.email,'has_details',d.user_id is not null,'age_declared',d.birth_date is not null);
end $$;
create function public.registration_save_v1(p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.myevent_account_active() then raise exception 'Connexion requise'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and lower(email)=lower(p->>'email')) then raise exception 'Adresse de connexion incohérente'; end if;
 perform registration_private.save(auth.uid(),p);
end $$;
create function public.registration_username_available_v1(p_username text) returns boolean language sql stable security definer set search_path='' as $$
 select p_username ~ '^[a-zA-Z0-9_]{3,30}$' and not exists(select 1 from public.profiles where lower(username)=lower(p_username) and id is distinct from auth.uid())
$$;

-- Unestablished/minor accounts keep private details; a declared birthday never grants adult rights.
create function registration_private.share_allowed(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.myevent_account_active() and
 (auth.uid()=target or (
  activities_private.adult_eligible(auth.uid()) and activities_private.adult_eligible(target)
  and not activities_private.blocked(auth.uid(),target)
  and exists(select 1 from registration_private.details d where d.user_id=target and d.visibility='members')
  and (public.are_friends(auth.uid(),target) or exists(
   select 1 from public.event_members a join public.event_members b on b.event_id=a.event_id
   where a.user_id=auth.uid() and b.user_id=target and a.status='accepted' and b.status='accepted'))
 ))
$$;
create function public.registration_public_v1(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.myevent_account_active() then raise exception 'Connexion requise'; end if;
 if not registration_private.share_allowed(p_user) then return null; end if;
 return (select jsonb_build_object('bio',bio,'interests',interests,'photo_path',(select name from storage.objects where bucket_id='registration-photos' and split_part(name,'/',1)=p_user::text order by created_at desc limit 1)) from registration_private.details where user_id=p_user);
end $$;
create function public.registration_photo_visible_v1(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select case when split_part(p_name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then registration_private.share_allowed(split_part(p_name,'/',1)::uuid) else false end
$$;
revoke all on all functions in schema registration_private from public,anon,authenticated;
revoke all on function public.registration_prepare_v1(jsonb),public.registration_username_available_v1(text),public.registration_self_v1(),public.registration_status_v1(),public.registration_save_v1(jsonb),public.registration_public_v1(uuid),public.registration_photo_visible_v1(text) from public,anon,authenticated;
grant execute on function public.registration_prepare_v1(jsonb),public.registration_username_available_v1(text) to anon,authenticated;
grant execute on function public.registration_self_v1(),public.registration_status_v1(),public.registration_save_v1(jsonb),public.registration_public_v1(uuid),public.registration_photo_visible_v1(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('registration-photos','registration-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy registration_photo_read on storage.objects for select to authenticated using(bucket_id='registration-photos' and public.registration_photo_visible_v1(name));
create policy registration_photo_insert on storage.objects for insert to authenticated with check(bucket_id='registration-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy registration_photo_delete on storage.objects for delete to authenticated using(bucket_id='registration-photos' and (storage.foldername(name))[1]=auth.uid()::text);
-- Existing permissive policies cannot accidentally grant read/write access to this new bucket.
create policy registration_photo_scope on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'registration-photos' or public.registration_photo_visible_v1(name))
 with check(bucket_id<>'registration-photos' or (storage.foldername(name))[1]=auth.uid()::text);
create policy registration_photo_no_anon on storage.objects as restrictive for all to anon
 using(bucket_id<>'registration-photos') with check(bucket_id<>'registration-photos');

-- Reuse the existing pg_cron installation; no external or paid service.
select cron.schedule('registration-expired-drafts','*/15 * * * *',$job$delete from registration_private.pending where expires_at<=now()$job$);
notify pgrst,'reload schema';
commit;
