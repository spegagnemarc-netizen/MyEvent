-- TEST only. Apply once AFTER games_engine and defis_game, after approval.
-- No existing data is removed. Answers remain private; all transitions are server-owned.
begin;
alter table public.game_rooms drop constraint game_rooms_game_key_check;
alter table public.game_rooms add constraint game_rooms_game_key_check check(game_key in ('infiltre','defis','truth','treasure','quiz','blind'));
create table game_private.activities (
 room_id uuid primary key references public.game_rooms(id) on delete cascade,
 items jsonb not null, phase text not null default 'waiting', choice text,
 deadline timestamptz
);
create table game_private.activity_answers (
 room_id uuid references public.game_rooms(id) on delete cascade,
 round_no int not null, user_id uuid references auth.users(id),
 answer text not null, correct boolean not null, attempts int not null default 1,
 primary key(room_id,round_no,user_id)
);
revoke all on game_private.activities,game_private.activity_answers from public,anon,authenticated;

create function public.activity_create(options jsonb default '{}',target_event uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();rid uuid;k text:=options->>'game_key';items jsonb;v jsonb;n int;p int:=coalesce((options->>'players')::int,6);rounds int:=coalesce((options->>'rounds')::int,5);
begin
 if uid is null then raise exception 'Connexion requise';end if;
 if k not in ('truth','treasure','quiz','blind') or k is null or p not between 2 and 12 or rounds not between 1 and 20 then raise exception 'Configuration de jeu invalide';end if;
 if target_event is not null and not game_private.event_member(target_event,uid) then raise exception 'Événement inaccessible';end if;
 if (select count(*) from public.game_rooms where host_id=uid and expires_at>now() and status in ('waiting','playing'))>=10 then raise exception 'Terminez une partie avant d’en créer une autre';end if;
 items:=options->'items';
 if k='truth' then
  items:='[{"truth":"Quel souvenir te fait sourire ?","dare":"Mime un animal que les autres doivent reconnaître."},{"truth":"Quel talent aimerais-tu apprendre ?","dare":"Inventez ensemble un cri de victoire."},{"truth":"Quel lieu rêves-tu de visiter ?","dare":"Dessine un objet les yeux fermés."},{"truth":"Quelle musique te met de bonne humeur ?","dare":"Fais deviner un film sans parler."},{"truth":"Quelle qualité apprécies-tu chez tes amis ?","dare":"Raconte une histoire avec trois mots choisis par le groupe."}]'::jsonb;
  select jsonb_agg(items->(i%5) order by i) into items from generate_series(0,rounds-1) i;
 elsif k='quiz' and items is null then
  items:='[{"prompt":"Quelle est la capitale de l’Italie ?","choices":["Rome","Madrid","Lisbonne","Athènes"],"answer":"0"},{"prompt":"Combien de côtés a un hexagone ?","choices":["Quatre","Cinq","Six","Huit"],"answer":"2"},{"prompt":"Quel océan borde la côte ouest de la France ?","choices":["Pacifique","Atlantique","Indien","Arctique"],"answer":"1"},{"prompt":"Quel instrument possède des touches noires et blanches ?","choices":["Flûte","Violon","Piano","Tambour"],"answer":"2"},{"prompt":"Quel est le plus grand mammifère ?","choices":["Éléphant","Girafe","Baleine bleue","Rhinocéros"],"answer":"2"}]'::jsonb;
 end if;
 if jsonb_typeof(items) is distinct from 'array' then raise exception 'Préparez les étapes ou les extraits avant de créer la partie';end if;
 n:=jsonb_array_length(items);if n not between 1 and 20 or length(items::text)>30000 then raise exception 'Entre 1 et 20 étapes sont requises';end if;
 for v in select * from jsonb_array_elements(items) loop
  if k in ('quiz','blind') then
   if length(coalesce(v->>'prompt','')) not between 1 and 400 or jsonb_typeof(v->'choices') is distinct from 'array' then raise exception 'Question invalide';end if;
   if jsonb_array_length(v->'choices')<>4 or coalesce(v->>'answer','') !~ '^[0-3]$' then raise exception 'Quatre choix et une réponse correcte sont requis';end if;
   if exists(select 1 from jsonb_array_elements_text(v->'choices') c where length(trim(c)) not between 1 and 150) then raise exception 'Choix invalide';end if;
   if k='blind' and (coalesce(v->>'audio_url','') !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or length(v->>'audio_url')>1500) then raise exception 'Lien audio HTTPS direct requis';end if;
  elsif k='treasure' then
   if length(trim(coalesce(v->>'prompt',''))) not between 1 and 500 or length(trim(coalesce(v->>'answer',''))) not between 1 and 100 then raise exception 'Chaque étape doit avoir un indice et un code-réponse';end if;
  end if;
 end loop;
 insert into public.game_rooms(host_id,event_id,game_key,settings) values(uid,target_event,k,jsonb_build_object('players',p,'rounds',n)) returning id into rid;
 insert into public.game_players(room_id,user_id) values(rid,uid);
 insert into game_private.activities(room_id,items) values(rid,items);
 return rid;
end $$;
create function public.activity_join(invitation_code text) returns uuid language sql security definer set search_path='' as $$select public.game_join(invitation_code)$$;
create function public.activity_my_rooms() returns jsonb language sql stable security definer set search_path='' as $$select public.game_my_rooms()$$;
create function public.activity_contacts(target_room uuid) returns jsonb language sql stable security definer set search_path='' as $$select public.game_contacts(target_room)$$;
create function public.activity_snapshot(target_room uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.game_rooms%rowtype;a game_private.activities%rowtype;q jsonb;actor uuid;
begin
 if not public.game_is_member(target_room) then raise exception 'Salon inaccessible ou expiré';end if;
 select * into r from public.game_rooms where id=target_room;
 select * into a from game_private.activities where room_id=target_room;
 if a.room_id is null then raise exception 'Ce salon utilise un autre moteur';end if;
 if r.status='playing' then
  q:=a.items->(r.round_no-1);
  if r.game_key='truth' then
   select user_id into actor from public.game_players where room_id=r.id and left_at is null order by joined_at,user_id offset ((r.round_no-1)%(select count(*) from public.game_players where room_id=r.id and left_at is null)) limit 1;
   q:=jsonb_build_object('prompt',case when a.choice in ('truth','dare') then q->>a.choice end,'actor',actor);
  else q:=q-'answer';end if;
  if a.phase='reveal' and r.game_key in ('quiz','blind') then q:=q||jsonb_build_object('answer',a.items->(r.round_no-1)->>'answer');end if;
 end if;
 return jsonb_build_object('room',to_jsonb(r),'me',auth.uid(),'phase',a.phase,'question',q,'deadline',a.deadline,
  'submitted',exists(select 1 from game_private.activity_answers where room_id=r.id and round_no=r.round_no and user_id=auth.uid()),
  'players',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('name',coalesce(pr.display_name,pr.username,'Joueur')) order by p.joined_at,p.user_id),'[]') from public.game_players p left join public.profiles pr on pr.id=p.user_id where p.room_id=r.id),
  'scores',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select user_id,sum(points) as points from public.game_scores where room_id=r.id group by user_id) s));
end $$;
create function public.activity_action(target_room uuid,action text,data jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();r public.game_rooms%rowtype;a game_private.activities%rowtype;q jsonb;actor uuid;target uuid;answer text;good boolean;cnt int;attempts int;
begin
 select * into r from public.game_rooms where id=target_room for update;
 if uid is null or not public.game_is_member(target_room) then raise exception 'Salon inaccessible ou expiré';end if;
 select * into a from game_private.activities where room_id=target_room;
 if a.room_id is null then raise exception 'Ce salon utilise un autre moteur';end if;
 if action in ('start','next','choose','done','pass','reveal','replay') and (data->>'revision')::bigint is distinct from r.revision then raise exception 'La partie a évolué. Réessayez';end if;
 update public.game_players set last_seen=now() where room_id=r.id and user_id=uid;
 if action='heartbeat' then return;
 elsif action='ready' then
  if r.status<>'waiting' then raise exception 'Partie déjà lancée';end if;
  update public.game_players set ready=coalesce((data->>'ready')::boolean,false) where room_id=r.id and user_id=uid;
 elsif action='invite' then
  target:=(data->>'target')::uuid;
  if r.status<>'waiting' or target=uid or target is null or not ((r.event_id is not null and game_private.event_member(r.event_id,target)) or (r.event_id is null and public.are_friends(uid,target))) then raise exception 'Invitation non autorisée';end if;
  insert into public.game_invitations(room_id,user_id,invited_by) values(r.id,target,uid) on conflict do nothing;
 elsif action='start' then
  if uid<>r.host_id or r.status<>'waiting' or (select count(*) from public.game_players where room_id=r.id and left_at is null)<2 or exists(select 1 from public.game_players where room_id=r.id and left_at is null and not ready) then raise exception 'L’hôte peut lancer lorsque deux joueurs au moins sont prêts';end if;
  update public.game_rooms set status='playing',round_no=1 where id=r.id;
  update game_private.activities set phase=case when r.game_key='truth' then 'choose' else 'active' end,choice=null,deadline=now()+interval '60 seconds' where room_id=r.id;
 elsif action in ('choose','done','pass') then
  if r.status<>'playing' or r.game_key<>'truth' then raise exception 'Action indisponible';end if;
  select user_id into actor from public.game_players where room_id=r.id and left_at is null order by joined_at,user_id offset ((r.round_no-1)%(select count(*) from public.game_players where room_id=r.id and left_at is null)) limit 1;
  if uid<>actor then raise exception 'Ce n’est pas votre tour';end if;
  if action='choose' then
   if a.phase<>'choose' or data->>'kind' not in ('truth','dare') or data->>'kind' is null then raise exception 'Choix invalide';end if;
   update game_private.activities set choice=data->>'kind',phase='active' where room_id=r.id;
  else
   if a.phase not in ('choose','active') then raise exception 'Tour déjà terminé';end if;
   if action='done' and a.phase<>'active' then raise exception 'Choisissez Action ou Vérité';end if;
   update game_private.activities set phase='reveal' where room_id=r.id;
   if action='done' then insert into public.game_scores(room_id,round_no,user_id,reason,points) values(r.id,r.round_no,uid,'participation',1);end if;
  end if;
 elsif action='answer' then
  if (data->>'round_no')::int is distinct from r.round_no then raise exception 'La manche a changé. Actualisez avant de répondre';end if;
  if r.status<>'playing' or a.phase<>'active' or r.game_key='truth' then raise exception 'Réponse indisponible';end if;
  answer:=trim(coalesce(data->>'answer',''));q:=a.items->(r.round_no-1);
  if r.game_key in ('quiz','blind') then
   if now()>a.deadline or answer !~ '^[0-3]$' then raise exception 'Réponse invalide ou délai dépassé';end if;
   if exists(select 1 from game_private.activity_answers where room_id=r.id and round_no=r.round_no and user_id=uid) then raise exception 'Réponse déjà envoyée';end if;
   good:=answer=q->>'answer';
   insert into game_private.activity_answers(room_id,round_no,user_id,answer,correct) values(r.id,r.round_no,uid,answer,good);
  else
   if length(answer) not between 1 and 100 then raise exception 'Code invalide';end if;
   select aa.attempts into attempts from game_private.activity_answers aa where room_id=r.id and round_no=r.round_no and user_id=uid;
   if coalesce(attempts,0)>=10 then raise exception 'Dix essais maximum pour cette étape';end if;
   good:=lower(answer)=lower(trim(q->>'answer'));
   insert into game_private.activity_answers(room_id,round_no,user_id,answer,correct) values(r.id,r.round_no,uid,answer,good) on conflict(room_id,round_no,user_id) do update set answer=excluded.answer,correct=excluded.correct,attempts=game_private.activity_answers.attempts+1;
   if good then
    insert into public.game_scores(room_id,round_no,user_id,reason,points) values(r.id,r.round_no,uid,'étape',1);
    update game_private.activities set phase='reveal' where room_id=r.id;
   end if;
  end if;
 elsif action='reveal' then
  if r.game_key not in ('quiz','blind') or uid<>r.host_id or r.status<>'playing' or a.phase<>'active' then raise exception 'Résultat indisponible';end if;
  if now()<a.deadline and exists(select 1 from public.game_players p where p.room_id=r.id and p.left_at is null and not exists(select 1 from game_private.activity_answers aa where aa.room_id=r.id and aa.round_no=r.round_no and aa.user_id=p.user_id)) then raise exception 'Attendez les réponses ou la fin du délai';end if;
  insert into public.game_scores(room_id,round_no,user_id,reason,points) select r.id,r.round_no,aa.user_id,'réponse',case when aa.correct then 1 else 0 end from game_private.activity_answers aa where aa.room_id=r.id and aa.round_no=r.round_no;
  update game_private.activities set phase='reveal' where room_id=r.id;
 elsif action='next' then
  if uid<>r.host_id or r.status<>'playing' or a.phase<>'reveal' then raise exception 'Tour suivant indisponible';end if;
  if r.round_no>=jsonb_array_length(a.items) then update public.game_rooms set status='finished' where id=r.id;update game_private.activities set phase='finished',choice=null where room_id=r.id;
  else update public.game_rooms set round_no=round_no+1 where id=r.id;update game_private.activities set phase=case when r.game_key='truth' then 'choose' else 'active' end,choice=null,deadline=now()+interval '60 seconds' where room_id=r.id;end if;
 elsif action='replay' then
  if uid<>r.host_id or r.status<>'finished' then raise exception 'Rejouer indisponible';end if;
  delete from game_private.activity_answers where room_id=r.id;delete from public.game_scores where room_id=r.id;
  update public.game_rooms set status='waiting',round_no=0,expires_at=now()+interval '24 hours' where id=r.id;
  update public.game_players set ready=false where room_id=r.id and left_at is null;
  update game_private.activities set phase='waiting',choice=null,deadline=null where room_id=r.id;
 elsif action='leave' then
  update public.game_players set left_at=now(),ready=false where room_id=r.id and user_id=uid;
  select user_id into target from public.game_players where room_id=r.id and left_at is null order by joined_at,user_id limit 1;
  if target is null then update public.game_rooms set status='closed' where id=r.id;
  elsif r.host_id=uid then update public.game_rooms set host_id=target where id=r.id;end if;
  if r.status='playing' and r.game_key='truth' and a.phase in ('choose','active') then update game_private.activities set phase='choose',choice=null where room_id=r.id;end if;
  if r.status='playing' and (select count(*) from public.game_players where room_id=r.id and left_at is null)<2 then update public.game_rooms set status='finished' where id=r.id;update game_private.activities set phase='finished' where room_id=r.id;end if;
 else raise exception 'Action inconnue';end if;
 update public.game_rooms set revision=revision+1 where id=r.id;
end $$;
-- Prevent the older engine being used to mutate a new game's room.
alter function public.game_action(uuid,text,jsonb) rename to game_infiltre_action;
revoke all on function public.game_infiltre_action(uuid,text,jsonb) from public,anon,authenticated;
create function public.game_action(target_room uuid,action text,data jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.game_rooms where id=target_room and game_key='infiltre') then raise exception 'Moteur de jeu incorrect';end if;
 perform public.game_infiltre_action(target_room,action,data);
end $$;
revoke all on function public.activity_create(jsonb,uuid),public.activity_join(text),public.activity_my_rooms(),public.activity_contacts(uuid),public.activity_snapshot(uuid),public.activity_action(uuid,text,jsonb),public.game_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.activity_create(jsonb,uuid),public.activity_join(text),public.activity_my_rooms(),public.activity_contacts(uuid),public.activity_snapshot(uuid),public.activity_action(uuid,text,jsonb),public.game_action(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
