-- Explorer: one owner record, optionally shared with an existing event.
begin;
create table public.personal_reservations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 event_id uuid references public.events(id) on delete set null,
 kind text not null check(kind in ('accommodation','transport','restaurant','activity','ticket')),
 details jsonb not null check(jsonb_typeof(details)='object' and octet_length(details::text)<=300000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index personal_reservations_owner on public.personal_reservations(owner_id,created_at desc);
create index personal_reservations_event on public.personal_reservations(event_id) where event_id is not null;
alter table public.personal_reservations enable row level security;
revoke all on public.personal_reservations from anon;
grant select,insert,update,delete on public.personal_reservations to authenticated;
create policy personal_read on public.personal_reservations for select to authenticated
 using(owner_id=auth.uid() or (event_id is not null and public.event_is_member(event_id)));
create policy personal_insert on public.personal_reservations for insert to authenticated
 with check(owner_id=auth.uid() and (event_id is null or public.event_is_manager(event_id)));
create policy personal_update on public.personal_reservations for update to authenticated
 using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy personal_delete on public.personal_reservations for delete to authenticated using(owner_id=auth.uid());
create function public.personal_reservation_guard() returns trigger language plpgsql set search_path='' as $$
declare p jsonb; b bytea;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.owner_id<>old.owner_id or new.created_at<>old.created_at then raise exception 'Identité immuable'; end if;
 end if;
 if new.event_id is not null then
  if tg_op='INSERT' or new.event_id is distinct from old.event_id then
   if not public.event_is_manager(new.event_id) then raise exception 'Rattachement réservé aux organisateurs'; end if;
  end if;
 end if;
 if coalesce(new.details->>'original_url','') !~ '^https://[^[:space:]]+$' then raise exception 'Lien HTTPS requis'; end if;
 if coalesce(new.details->>'reservation_status','') not in ('added','confirmed') then raise exception 'Statut invalide'; end if;
 if new.details->>'reservation_status'='confirmed' and coalesce(new.details->>'confirmation_source','')<>'user_declared' then raise exception 'Confirmation explicite requise'; end if;
 p:=new.details->'proof';
 if p is not null and p<>'null'::jsonb then
  if jsonb_typeof(p)<>'object' or coalesce(p->>'type','') not in ('application/pdf','image/png','image/jpeg') or length(coalesce(p->>'base64','')) not between 1 and 280000 or coalesce(p->>'name','')='' or coalesce(p->>'size','') !~ '^[0-9]+$' then raise exception 'Justificatif invalide'; end if;
  b:=decode(p->>'base64','base64');
  if octet_length(b) not between 1 and 204800 or octet_length(b)<>(p->>'size')::integer then raise exception 'Taille justificatif invalide'; end if;
  if (p->>'type'='application/pdf' and substring(b from 1 for 5)<>decode('255044462d','hex')) or
     (p->>'type'='image/png' and substring(b from 1 for 8)<>decode('89504e470d0a1a0a','hex')) or
     (p->>'type'='image/jpeg' and substring(b from 1 for 3)<>decode('ffd8ff','hex')) then raise exception 'Contenu justificatif invalide'; end if;
 end if;
 new.updated_at:=now();return new;
end $$;
create trigger personal_reservation_guard before insert or update on public.personal_reservations for each row execute function public.personal_reservation_guard();
commit;
