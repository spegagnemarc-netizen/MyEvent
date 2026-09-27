-- MyEvent Games: Défis MyEvent engine.
-- Apply once after 202609270002_games_engine.sql. Do not rerun older game migrations.
begin;

alter table public.game_rooms drop constraint if exists game_rooms_game_key_check;
alter table public.game_rooms add constraint game_rooms_game_key_check check(game_key in ('infiltre','defis'));

create table public.game_challenges (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  number int not null,
  kind text not null check(kind in ('individual','collective')),
  challenge text not null,
  target_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','active','completed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  primary key(room_id,number)
);
alter table public.game_challenges enable row level security;
create policy games_challenges_read on public.game_challenges for select to authenticated using(public.game_is_member(room_id));
revoke all on public.game_challenges from public,anon,authenticated;
grant select on public.game_challenges to authenticated;

create table game_private.defis_catalog (
  id bigint generated always as identity primary key,
  kind text not null check(kind in ('individual','collective')),
  challenge text not null unique
);
alter table game_private.defis_catalog enable row level security;
revoke all on game_private.defis_catalog from public,anon,authenticated;

insert into game_private.defis_catalog(kind,challenge) values
 ('individual','Fais rire au moins un autre joueur en 30 secondes.'),
 ('individual','Imite un animal jusqu’à ce que quelqu’un le reconnaisse.'),
 ('individual','Fais deviner un film sans prononcer son titre ni le nom d’un acteur.'),
 ('individual','Tiens en équilibre sur un pied pendant 20 secondes.'),
 ('individual','Fais une mini danse improvisée pendant 15 secondes.'),
 ('individual','Raconte une histoire vraie en seulement trois phrases.'),
 ('individual','Fais deviner un objet présent autour de vous sans le montrer.'),
 ('individual','Parle avec un accent inventé pendant 30 secondes sans rire.'),
 ('individual','Mime une activité choisie par le groupe.'),
 ('individual','Fais un compliment original à chaque joueur.'),
 ('individual','Trouve quelque chose de la couleur choisie par le groupe en moins de 30 secondes.'),
 ('individual','Prends une pose de star et tiens-la pendant 10 secondes.'),
 ('individual','Fais deviner une chanson uniquement en la fredonnant.'),
 ('individual','Dis trois mots qui commencent par la même lettre en moins de 5 secondes.'),
 ('individual','Fais une photo créative avec un objet choisi par le groupe.'),
 ('collective','Prenez une photo de groupe avec exactement la même expression.'),
 ('collective','Inventez ensemble un cri d’équipe MyEvent et faites-le en même temps.'),
 ('collective','Mettez-vous dans l’ordre de vos mois de naissance sans parler.'),
 ('collective','Faites une photo où personne ne touche le sol de la même façon.'),
 ('collective','Choisissez un mot et dites-le tous exactement au même moment après un compte à rebours.'),
 ('collective','Créez une pose de groupe qui pourrait devenir votre photo souvenir.'),
 ('collective','Trouvez cinq objets de couleurs différentes en moins d’une minute.'),
 ('collective','Faites passer un mime de joueur en joueur et comparez le résultat final.'),
 ('collective','Inventez une courte chorégraphie de trois mouvements et réalisez-la ensemble.'),
 ('collective','Prenez une photo où chacun représente une émotion différente.'),
 ('collective','Trouvez un point commun entre tous les joueurs en moins d’une minute.'),
 ('collective','Formez une lettre géante avec vos corps ou vos bras et prenez une photo.');

create function game_private.defis_start(rid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms%rowtype;
  ids uuid[];
  total int;
  i int;
  k text;
  c game_private.defis_catalog%rowtype;
  used bigint[]:=array[]::bigint[];
  target uuid;
begin
  select * into r from public.game_rooms where id=rid and game_key='defis';
  if r.id is null then raise exception 'Salon Défis introuvable'; end if;
  select array_agg(user_id order by random()) into ids
  from public.game_players where room_id=rid and left_at is null;
  if coalesce(cardinality(ids),0)<2 then raise exception 'Il faut au moins deux joueurs'; end if;
  total:=least(12,greatest(3,coalesce((r.settings->>'challenges')::int,8)));
  delete from public.game_challenges where room_id=rid;
  delete from public.game_scores where room_id=rid;
  delete from public.game_events where room_id=rid;
  for i in 1..total loop
    k:=case when i%3=0 then 'collective' else 'individual' end;
    select * into c from game_private.defis_catalog d
      where d.kind=k and not (d.id=any(used))
      order by random() limit 1;
    if c.id is null then
      select * into c from game_private.defis_catalog d where d.kind=k order by random() limit 1;
    end if;
    used:=array_append(used,c.id);
    target:=case when k='individual' then ids[1+mod(i-1,cardinality(ids))] else null end;
    insert into public.game_challenges(room_id,number,kind,challenge,target_id,status,started_at)
    values(rid,i,k,c.challenge,target,case when i=1 then 'active' else 'pending' end,case when i=1 then now() else null end);
  end loop;
  update public.game_rooms set status='playing',round_no=1 where id=rid;
  update public.game_players set alive=true,revealed=false where room_id=rid and left_at is null;
  insert into public.game_events(room_id,kind,payload) values(rid,'defis_started',jsonb_build_object('count',total));
end $$;

create function game_private.defis_next(rid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare next_no int;
begin
  select min(number) into next_no from public.game_challenges where room_id=rid and status='pending';
  if next_no is null then
    update public.game_rooms set status='finished' where id=rid;
    insert into public.game_events(room_id,kind,payload) values(rid,'defis_finished','{}'::jsonb);
  else
    update public.game_challenges set status='active',started_at=now() where room_id=rid and number=next_no;
  end if;
end $$;

create function public.defis_create(options jsonb default '{}', target_event uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  rid uuid;
  uid uuid:=auth.uid();
  capacity int:=coalesce((options->>'players')::int,6);
  total int:=coalesce((options->>'challenges')::int,8);
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  delete from public.game_rooms where expires_at<now();
  if capacity not between 2 and 12 or total not between 3 and 12 then raise exception 'Paramètres invalides'; end if;
  if target_event is not null and not game_private.event_member(target_event,uid) then raise exception 'Accès événement refusé'; end if;
  perform pg_advisory_xact_lock(hashtextextended('game-create:'||uid::text,0));
  if (select count(*) from public.game_rooms where host_id=uid and expires_at>now() and status in ('waiting','playing'))>=5 then raise exception 'Ferme un salon avant d’en créer un autre'; end if;
  insert into public.game_rooms(game_key,host_id,event_id,settings)
  values('defis',uid,target_event,jsonb_build_object('players',capacity,'challenges',total,'rounds',1,'mode','mixed'))
  returning id into rid;
  insert into public.game_players(room_id,user_id) values(rid,uid);
  return rid;
end $$;

create function public.defis_join(invitation_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms%rowtype; uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.game_rooms
    where code=upper(trim(invitation_code)) and game_key='defis' and expires_at>now() and status in ('waiting','playing','finished')
    for update;
  if r.id is null then raise exception 'Code Défis invalide ou salon expiré'; end if;
  if r.event_id is not null and not game_private.event_member(r.event_id,uid) then raise exception 'Ce salon est réservé aux participants de l’événement'; end if;
  if exists(select 1 from public.game_players where room_id=r.id and user_id=uid and left_at is null) then return r.id; end if;
  if r.status<>'waiting' then raise exception 'La partie est déjà lancée'; end if;
  if (select count(*) from public.game_players where room_id=r.id and left_at is null)>=(r.settings->>'players')::int then raise exception 'Salon complet'; end if;
  insert into public.game_players(room_id,user_id) values(r.id,uid)
    on conflict(room_id,user_id) do update set left_at=null,ready=false,alive=true,last_seen=now();
  update public.game_rooms set revision=revision+1 where id=r.id;
  return r.id;
end $$;

create function public.defis_snapshot(target_room uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.game_rooms%rowtype; result jsonb;
begin
  if not public.game_is_member(target_room) then raise exception 'Salon inaccessible ou expiré'; end if;
  select * into r from public.game_rooms where id=target_room and game_key='defis';
  if r.id is null then raise exception 'Ce salon n’est pas une partie Défis'; end if;
  select jsonb_build_object(
    'room',to_jsonb(r),
    'me',auth.uid(),
    'players',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('name',coalesce(pr.display_name,pr.username,'Membre MyEvent'),'avatar',pr.avatar) order by p.joined_at),'[]'::jsonb)
      from public.game_players p left join public.profiles pr on pr.id=p.user_id where p.room_id=r.id),
    'challenge',(select to_jsonb(c) from public.game_challenges c where c.room_id=r.id and c.status='active' order by c.number limit 1),
    'progress',jsonb_build_object(
      'done',(select count(*) from public.game_challenges where room_id=r.id and status in ('completed','skipped')),
      'total',(select count(*) from public.game_challenges where room_id=r.id)
    ),
    'scores',(select coalesce(jsonb_agg(to_jsonb(sc)),'[]'::jsonb) from public.game_scores sc where sc.room_id=r.id),
    'events',(select coalesce(jsonb_agg(to_jsonb(ev) order by ev.id),'[]'::jsonb) from (select * from public.game_events where room_id=r.id order by id desc limit 20) ev)
  ) into result;
  return result;
end $$;

create function public.defis_my_rooms() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'status',r.status,'game_key',r.game_key,'invited',not exists(select 1 from public.game_players p where p.room_id=r.id and p.user_id=auth.uid() and p.left_at is null)) order by r.created_at desc),'[]'::jsonb)
 from public.game_rooms r where auth.uid() is not null and r.game_key='defis' and r.expires_at>now() and r.status<>'closed' and
 (exists(select 1 from public.game_players p where p.room_id=r.id and p.user_id=auth.uid() and p.left_at is null)
 or (r.status='waiting' and exists(select 1 from public.game_invitations i where i.room_id=r.id and i.user_id=auth.uid())))
$$;

create function public.defis_contacts(target_room uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select public.game_contacts(target_room)
$$;

create function public.defis_action(target_room uuid, action text, data jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms%rowtype;
  p public.game_players%rowtype;
  c public.game_challenges%rowtype;
  uid uuid:=auth.uid();
  target uuid;
  next_host uuid;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.game_rooms where id=target_room for update;
  if r.id is null or r.game_key<>'defis' or not public.game_is_member(r.id) then raise exception 'Salon Défis inaccessible ou expiré'; end if;
  select * into p from public.game_players where room_id=r.id and user_id=uid;
  if action in ('start','complete','skip','replay') and (data->>'revision')::bigint is distinct from r.revision then raise exception 'La partie a évolué. Réessaie.'; end if;
  update public.game_players set last_seen=now() where room_id=r.id and user_id=uid;

  if action='heartbeat' then return;
  elsif action='ready' then
    if r.status<>'waiting' then raise exception 'Partie déjà lancée'; end if;
    update public.game_players set ready=coalesce((data->>'ready')::boolean,false) where room_id=r.id and user_id=uid;
  elsif action='invite' then
    target:=(data->>'target')::uuid;
    if r.status<>'waiting' or target is null or not ((r.event_id is null and public.are_friends(uid,target)) or (r.event_id is not null and game_private.event_member(r.event_id,target))) then raise exception 'Invitation non autorisée'; end if;
    insert into public.game_invitations(room_id,user_id,invited_by) values(r.id,target,uid) on conflict do nothing;
  elsif action='start' then
    if r.host_id<>uid or r.status<>'waiting' then raise exception 'Seul l’hôte peut lancer le salon'; end if;
    if (select count(*) from public.game_players where room_id=r.id and left_at is null)<2
       or exists(select 1 from public.game_players where room_id=r.id and left_at is null and not ready)
      then raise exception 'Il faut au moins deux joueurs, tous prêts'; end if;
    perform game_private.defis_start(r.id);
  elsif action in ('complete','skip') then
    if r.host_id<>uid or r.status<>'playing' then raise exception 'Seul l’hôte valide les défis'; end if;
    select * into c from public.game_challenges where room_id=r.id and status='active' order by number limit 1 for update;
    if c.room_id is null then raise exception 'Aucun défi actif'; end if;
    if action='complete' then
      update public.game_challenges set status='completed',completed_at=now(),completed_by=uid where room_id=r.id and number=c.number;
      if c.kind='individual' and c.target_id is not null and exists(select 1 from public.game_players where room_id=r.id and user_id=c.target_id and left_at is null) then
        insert into public.game_scores(room_id,round_no,user_id,reason,points) values(r.id,1,c.target_id,'defi_'||c.number,2) on conflict do nothing;
      elsif c.kind='collective' then
        insert into public.game_scores(room_id,round_no,user_id,reason,points)
        select r.id,1,gp.user_id,'defi_'||c.number,1 from public.game_players gp where gp.room_id=r.id and gp.left_at is null on conflict do nothing;
      end if;
      insert into public.game_events(room_id,kind,actor_id,payload) values(r.id,'defi_completed',uid,jsonb_build_object('number',c.number,'kind',c.kind,'target',c.target_id));
    else
      update public.game_challenges set status='skipped',completed_at=now(),completed_by=uid where room_id=r.id and number=c.number;
      insert into public.game_events(room_id,kind,actor_id,payload) values(r.id,'defi_skipped',uid,jsonb_build_object('number',c.number));
    end if;
    perform game_private.defis_next(r.id);
  elsif action='replay' then
    if uid<>r.host_id or r.status<>'finished' then raise exception 'Rejouer indisponible'; end if;
    delete from public.game_challenges where room_id=r.id;
    delete from public.game_scores where room_id=r.id;
    delete from public.game_events where room_id=r.id;
    update public.game_rooms set status='waiting',round_no=0,expires_at=now()+interval '24 hours' where id=r.id;
    update public.game_players set ready=false,alive=true,revealed=false where room_id=r.id and left_at is null;
  elsif action in ('leave','remove_absent') then
    target:=uid;
    if action='remove_absent' then
      target:=(data->>'target')::uuid;
      if r.host_id<>uid or target is null or target=uid or not exists(select 1 from public.game_players where room_id=r.id and user_id=target and left_at is null and last_seen<now()-interval '2 minutes') then raise exception 'Seul un joueur absent depuis deux minutes peut être retiré par l’hôte'; end if;
    end if;
    update public.game_players set left_at=now(),alive=false,ready=false where room_id=r.id and user_id=target;
    select user_id into next_host from public.game_players where room_id=r.id and left_at is null order by joined_at limit 1;
    if next_host is null then
      update public.game_rooms set status='closed' where id=r.id;
    else
      if r.host_id=target then update public.game_rooms set host_id=next_host where id=r.id; end if;
      select * into c from public.game_challenges where room_id=r.id and status='active' order by number limit 1;
      if r.status='playing' and c.kind='individual' and c.target_id=target then
        update public.game_challenges set status='skipped',completed_at=now() where room_id=r.id and number=c.number;
        perform game_private.defis_next(r.id);
      end if;
    end if;
  elsif action='claim_host' then
    if r.host_id=uid or exists(select 1 from public.game_players where room_id=r.id and user_id=r.host_id and left_at is null and last_seen>now()-interval '2 minutes') then raise exception 'L’hôte est encore présent'; end if;
    update public.game_rooms set host_id=uid where id=r.id;
  else
    raise exception 'Action Défis inconnue';
  end if;
  update public.game_rooms set revision=revision+1 where id=r.id;
end $$;

revoke all on all functions in schema game_private from public,anon,authenticated;
revoke all on function public.defis_create(jsonb,uuid),public.defis_join(text),public.defis_snapshot(uuid),public.defis_my_rooms(),public.defis_contacts(uuid),public.defis_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.defis_create(jsonb,uuid),public.defis_join(text),public.defis_snapshot(uuid),public.defis_my_rooms(),public.defis_contacts(uuid),public.defis_action(uuid,text,jsonb) to authenticated;

commit;
