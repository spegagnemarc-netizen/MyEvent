-- MyEvent games: public room state, private game engines, serialized server actions.
-- Apply manually after 202609270001. No existing module policies are changed.
begin;
create schema if not exists game_private;
revoke all on schema game_private from public, anon, authenticated;

create table public.game_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
 game_key text not null default 'infiltre' check(game_key='infiltre'),
 host_id uuid not null references auth.users(id),
 event_id uuid references public.events(id) on delete cascade,
 status text not null default 'waiting' check(status in ('waiting','playing','finished','closed')),
 settings jsonb not null,
 round_no int not null default 0,
 revision bigint not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours'
);
create index game_rooms_expiry on public.game_rooms(expires_at);
create table public.game_players (
 room_id uuid references public.game_rooms(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 ready boolean not null default false,
 alive boolean not null default true,
 revealed boolean not null default false,
 joined_at timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 left_at timestamptz,
 primary key(room_id,user_id)
);
create index game_players_user on public.game_players(user_id,room_id);
create table public.game_rounds (
 room_id uuid references public.game_rooms(id) on delete cascade,
 number int not null,
 phase text not null default 'reveal' check(phase in ('reveal','clues','extra_clue','discussion','voting','result','round_end')),
 cycle int not null default 1,
 speaker_order uuid[] not null,
 turn_index int not null default 1,
 extra_target uuid,
 deadline timestamptz,
 result jsonb not null default '{}',
 primary key(room_id,number)
);
create table public.game_scores (
 id bigint generated always as identity primary key,
 room_id uuid references public.game_rooms(id) on delete cascade,
 round_no int not null,
 user_id uuid references auth.users(id) on delete cascade,
 reason text not null,
 points int not null,
 unique(room_id,round_no,user_id,reason)
);
create table public.game_invitations (
 room_id uuid references public.game_rooms(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 invited_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(room_id,user_id)
);
create table public.game_events (
 id bigint generated always as identity primary key,
 room_id uuid references public.game_rooms(id) on delete cascade,
 kind text not null,
 actor_id uuid references auth.users(id),
 payload jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index game_events_room on public.game_events(room_id,id);

create table game_private.word_pairs (
 id bigint generated always as identity primary key,
 category text not null, word_a text not null, word_b text not null,
 room_id uuid references public.game_rooms(id) on delete cascade
);
-- Original MyEvent selection; never sent to clients as a bank.
insert into game_private.word_pairs(category,word_a,word_b) values
 ('general','Phare','Sémaphore'),('general','Boussole','Carte'),('general','Bougie','Lanterne'),('general','Horloge','Sablier'),
 ('general','Bibliothèque','Librairie'),('general','Balcon','Terrasse'),('general','Valise','Sac à dos'),('general','Parapluie','Parasol'),
 ('soiree','Confettis','Paillettes'),('soiree','Toast','Discours'),('soiree','Guirlande','Lampion'),('soiree','Bal','Festival'),
 ('soiree','Costume','Déguisement'),('soiree','Invitation','Faire-part'),('soiree','Buffet','Banquet'),('soiree','Karaoké','Concert'),
 ('voyage','Auberge','Chalet'),('voyage','Ferry','Paquebot'),('voyage','Escale','Correspondance'),('voyage','Camping','Bivouac'),
 ('voyage','Dune','Falaise'),('voyage','Tramway','Métro'),('voyage','Passeport','Visa'),('voyage','Sentier','Piste'),
 ('sport','Kayak','Aviron'),('sport','Escrime','Boxe'),('sport','Sprint','Relais'),('sport','Patinage','Roller'),
 ('sport','Escalade','Alpinisme'),('sport','Surf','Paddle'),('sport','Tennis','Badminton'),('sport','Slalom','Descente'),
 ('nourriture','Abricot','Pêche'),('nourriture','Crêpe','Gaufre'),('nourriture','Compote','Confiture'),('nourriture','Basilic','Menthe'),
 ('nourriture','Risotto','Paella'),('nourriture','Soupe','Velouté'),('nourriture','Brioche','Croissant'),('nourriture','Sorbet','Granité'),
 ('animaux','Héron','Cigogne'),('animaux','Loutre','Castor'),('animaux','Abeille','Bourdon'),('animaux','Hibou','Chouette'),
 ('animaux','Dauphin','Orque'),('animaux','Renard','Loup'),('animaux','Tortue','Escargot'),('animaux','Pingouin','Manchot');
create table game_private.secrets (
 room_id uuid, round_no int, user_id uuid,
 role text not null, word text not null,
 mission text, mission_claimed boolean not null default false, mission_approved_by uuid,
 power text, power_used boolean not null default false,
 shield_cycle int, double_cycle int, silence_cycle int,
 primary key(room_id,round_no,user_id),
 foreign key(room_id,user_id) references public.game_players(room_id,user_id) on delete cascade
);
create table game_private.used_pairs (
 room_id uuid references public.game_rooms(id) on delete cascade,
 pair_id bigint references game_private.word_pairs(id) on delete cascade,
 used_at timestamptz not null default clock_timestamp(),
 primary key(room_id,pair_id)
);
create table game_private.votes (
 room_id uuid, round_no int, cycle int, voter uuid, target uuid, weight int not null,
 primary key(room_id,round_no,cycle,voter),
 foreign key(room_id,voter) references public.game_players(room_id,user_id) on delete cascade
);
alter table game_private.word_pairs enable row level security;
alter table game_private.secrets enable row level security;
alter table game_private.votes enable row level security;
alter table game_private.used_pairs enable row level security;
revoke all on all tables in schema game_private from public,anon,authenticated;

create function public.game_is_member(target_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.game_players p join public.game_rooms r on r.id=p.room_id
 where p.room_id=target_room and p.user_id=auth.uid() and p.left_at is null and r.expires_at>now())
$$;
revoke all on function public.game_is_member(uuid) from public;
grant execute on function public.game_is_member(uuid) to authenticated;
alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;
alter table public.game_rounds enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_events enable row level security;
alter table public.game_invitations enable row level security;
create policy games_room_read on public.game_rooms for select to authenticated using(public.game_is_member(id));
create policy games_players_read on public.game_players for select to authenticated using(public.game_is_member(room_id));
create policy games_rounds_read on public.game_rounds for select to authenticated using(public.game_is_member(room_id));
create policy games_scores_read on public.game_scores for select to authenticated using(public.game_is_member(room_id));
create policy games_events_read on public.game_events for select to authenticated using(public.game_is_member(room_id));
create policy games_invites_read on public.game_invitations for select to authenticated using(user_id=auth.uid());
revoke all on public.game_rooms,public.game_players,public.game_rounds,public.game_scores,public.game_events,public.game_invitations from anon,authenticated;
grant select on public.game_rooms,public.game_players,public.game_rounds,public.game_scores,public.game_events,public.game_invitations to authenticated;

-- Single extension point for future event animation permissions. Does not create event roles.
create function game_private.event_member(eid uuid, uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events where id=eid and creator_id=uid)
 or exists(select 1 from public.event_members where event_id=eid and user_id=uid)
$$;
create function game_private.start_round(rid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms%rowtype; pair game_private.word_pairs%rowtype; ids uuid[]; uid uuid; idx int:=0; n int;
 missions text[]:=array['Fais rire un autre joueur.','Fais prononcer « oui » à quelqu’un.','Défends un joueur pendant le débat.','Accuse deux personnes différentes pendant le débat.','Place naturellement le mot « formidable ».','Demande à un joueur de reformuler son indice.'];
 powers text[]:=array['immunity','double_vote','second_clue','protection','silence'];
begin
 select * into r from public.game_rooms where id=rid;
 select * into pair from game_private.word_pairs w where
 ((w.room_id=rid) or (w.room_id is null and not exists(select 1 from game_private.word_pairs where room_id=rid) and (r.settings->>'category'='all' or w.category=r.settings->>'category')))
 and not exists(select 1 from game_private.used_pairs u where u.room_id=rid and u.pair_id=w.id)
 order by random() limit 1;
 if pair.id is null then
   -- Refill an exhausted bank, but never repeat the immediately preceding pair.
   select * into pair from game_private.word_pairs w where
   ((w.room_id=rid) or (w.room_id is null and not exists(select 1 from game_private.word_pairs where room_id=rid) and (r.settings->>'category'='all' or w.category=r.settings->>'category')))
   and w.id<>(select pair_id from game_private.used_pairs where room_id=rid order by used_at desc limit 1)
   order by random() limit 1;
   if pair.id is null then raise exception 'Ajoute au moins deux paires personnalisées pour pouvoir rejouer avec de nouveaux mots'; end if;
   delete from game_private.used_pairs where room_id=rid;
 end if;
 select array_agg(user_id order by random()) into ids from public.game_players where room_id=rid and left_at is null;
 n:=least((r.settings->>'infiltrators')::int, greatest(1,(cardinality(ids)-1)/3));
 update public.game_rooms set round_no=round_no+1,status='playing' where id=rid returning * into r;
 update public.game_players set alive=true,revealed=false where room_id=rid and left_at is null;
 insert into game_private.used_pairs(room_id,pair_id) values(rid,pair.id);
 foreach uid in array ids loop
   idx:=idx+1;
   insert into game_private.secrets(room_id,round_no,user_id,role,word,mission,power)
   values(rid,r.round_no,uid,case when idx<=n then 'infiltrator' else 'citizen' end,case when idx<=n then pair.word_b else pair.word_a end,
     case when (r.settings->>'missions')::boolean then missions[1+floor(random()*cardinality(missions))::int] end,
     case when (r.settings->>'powers')::boolean then powers[1+floor(random()*cardinality(powers))::int] end);
 end loop;
 -- Independent order must not reveal the role assignment order.
 select array_agg(user_id order by random()) into ids from public.game_players where room_id=rid and left_at is null;
 insert into public.game_rounds(room_id,number,speaker_order) values(rid,r.round_no,ids);
end $$;

create function game_private.finish_round(rid uuid, winner text) returns void
language plpgsql security definer set search_path='' as $$
declare rn int; roles jsonb;
begin
 select round_no into rn from public.game_rooms where id=rid;
 select jsonb_agg(jsonb_build_object('user_id',s.user_id,'role',s.role,'word',s.word,'mission',s.mission,'mission_claimed',s.mission_claimed)) into roles
 from game_private.secrets s where s.room_id=rid and s.round_no=rn;
 insert into public.game_scores(room_id,round_no,user_id,reason,points)
 select rid,rn,s.user_id,'camp',5 from game_private.secrets s join public.game_players p on p.room_id=s.room_id and p.user_id=s.user_id
 where s.room_id=rid and s.round_no=rn and s.role=winner and p.left_at is null on conflict do nothing;
 insert into public.game_scores(room_id,round_no,user_id,reason,points)
 select rid,rn,s.user_id,'survie',2 from game_private.secrets s join public.game_players p on p.room_id=s.room_id and p.user_id=s.user_id
 where s.room_id=rid and s.round_no=rn and s.role='infiltrator' and p.alive and p.left_at is null on conflict do nothing;
 insert into public.game_scores(room_id,round_no,user_id,reason,points)
 select rid,rn,v.voter,'detection',count(*)::int from game_private.votes v join game_private.secrets s on s.room_id=v.room_id and s.round_no=v.round_no and s.user_id=v.target
 where v.room_id=rid and v.round_no=rn and s.role='infiltrator' group by v.voter on conflict do nothing;
 update public.game_rounds set phase='round_end',deadline=null,result=result||jsonb_build_object('winner',winner,'roles',roles) where room_id=rid and number=rn;
end $$;

create function game_private.check_winner(rid uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare good int; bad int; rn int;
begin
 select round_no into rn from public.game_rooms where id=rid;
 select count(*) filter(where s.role='citizen'),count(*) filter(where s.role='infiltrator') into good,bad
 from game_private.secrets s join public.game_players p on p.room_id=s.room_id and p.user_id=s.user_id
 where s.room_id=rid and s.round_no=rn and p.alive and p.left_at is null;
 if bad=0 then perform game_private.finish_round(rid,'citizen'); return true;
 elsif bad>=good then perform game_private.finish_round(rid,'infiltrator'); return true; end if;
 return false;
end $$;

create function game_private.resolve_vote(rid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.game_rounds%rowtype; rn int; expected int; received int; maxvotes int; targets uuid[]; eliminated uuid; protected boolean:=false; role_name text;
begin
 select round_no into rn from public.game_rooms where id=rid;
 select * into q from public.game_rounds where room_id=rid and number=rn;
 if q.phase<>'voting' then return; end if;
 select count(*) into expected from public.game_players p join game_private.secrets s on s.room_id=p.room_id and s.user_id=p.user_id and s.round_no=rn
 where p.room_id=rid and p.alive and p.left_at is null and coalesce(s.silence_cycle,0)<>q.cycle;
 select count(*) into received from game_private.votes v join public.game_players p on p.room_id=v.room_id and p.user_id=v.voter
 where v.room_id=rid and v.round_no=rn and v.cycle=q.cycle and p.alive and p.left_at is null;
 if received<expected and now()<q.deadline then return; end if;
 select max(total) into maxvotes from (select sum(v.weight) total from game_private.votes v
 join public.game_players p on p.room_id=v.room_id and p.user_id=v.target and p.alive and p.left_at is null
 join public.game_players voter on voter.room_id=v.room_id and voter.user_id=v.voter and voter.left_at is null
 where v.room_id=rid and v.round_no=rn and v.cycle=q.cycle group by v.target) counts;
 select array_agg(target) into targets from (select v.target,sum(v.weight) total from game_private.votes v
 join public.game_players p on p.room_id=v.room_id and p.user_id=v.target and p.alive and p.left_at is null
 join public.game_players voter on voter.room_id=v.room_id and voter.user_id=v.voter and voter.left_at is null
 where v.room_id=rid and v.round_no=rn and v.cycle=q.cycle group by v.target) counts where total=maxvotes;
 if cardinality(targets)=1 then
   eliminated:=targets[1];
   select coalesce(shield_cycle,0)=q.cycle,role into protected,role_name from game_private.secrets where room_id=rid and round_no=rn and user_id=eliminated;
   if protected then eliminated:=null; role_name:=null;
   else update public.game_players set alive=false where room_id=rid and user_id=eliminated; end if;
 end if;
 update public.game_rounds set phase='result',deadline=null,result=jsonb_build_object('eliminated',eliminated,'role',role_name,'protected',protected,'tie',coalesce(cardinality(targets),0)<>1,'received',received,'expected',expected)
 where room_id=rid and number=rn;
 perform game_private.check_winner(rid);
end $$;

create function public.game_create(options jsonb default '{}', target_event uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; uid uuid:=auth.uid(); capacity int:=coalesce((options->>'players')::int,6); rounds int:=coalesce((options->>'rounds')::int,3);
 mode text:=coalesce(options->>'mode','classic'); category text:=coalesce(options->>'category','all'); n int; pair jsonb; custom jsonb:=coalesce(options->'pairs','[]');
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 -- Opportunistic cleanup also works when pg_cron has not been enabled.
 delete from public.game_rooms where expires_at<now();
 if capacity not between 4 and 12 or rounds not between 1 and 7 or mode not in ('classic','missions','myevent') or category not in ('all','general','soiree','voyage','sport','nourriture','animaux') then raise exception 'Paramètres invalides'; end if;
 n:=coalesce((options->>'infiltrators')::int,greatest(1,(capacity-1)/3));
 if n not between 1 and greatest(1,(capacity-1)/3) then raise exception 'Trop d’infiltrés pour ce groupe'; end if;
 if target_event is not null and not game_private.event_member(target_event,uid) then raise exception 'Accès événement refusé'; end if;
 perform pg_advisory_xact_lock(hashtextextended('game-create:'||uid::text,0));
 if (select count(*) from public.game_rooms where host_id=uid and expires_at>now() and status in ('waiting','playing'))>=5 then raise exception 'Ferme un salon avant d’en créer un autre'; end if;
 if jsonb_typeof(custom)<>'array' or jsonb_array_length(custom)>100 then raise exception 'Paires invalides'; end if;
 if jsonb_array_length(custom)>0 and jsonb_array_length(custom)<rounds then raise exception 'Prévois au moins une paire différente par manche'; end if;
 insert into public.game_rooms(host_id,event_id,settings) values(uid,target_event,jsonb_build_object('players',capacity,'rounds',rounds,'mode',mode,'category',category,'infiltrators',n,
 'missions',mode<>'classic' and coalesce((options->>'missions')::boolean,true),'powers',mode='myevent' and coalesce((options->>'powers')::boolean,true),'custom',jsonb_array_length(custom)>0)) returning id into rid;
 for pair in select * from jsonb_array_elements(custom) loop
   if jsonb_typeof(pair)<>'array' or jsonb_array_length(pair)<>2 or length(trim(pair->>0)) not between 1 and 40 or length(trim(pair->>1)) not between 1 and 40 or lower(trim(pair->>0))=lower(trim(pair->>1)) then raise exception 'Chaque paire doit contenir deux mots différents (40 caractères maximum)'; end if;
   if exists(select 1 from game_private.word_pairs where room_id=rid and (lower(word_a)=lower(trim(pair->>0)) and lower(word_b)=lower(trim(pair->>1)) or lower(word_b)=lower(trim(pair->>0)) and lower(word_a)=lower(trim(pair->>1)))) then raise exception 'Paires en double'; end if;
   insert into game_private.word_pairs(category,word_a,word_b,room_id) values('custom',trim(pair->>0),trim(pair->>1),rid);
 end loop;
 insert into public.game_players(room_id,user_id) values(rid,uid);
 return rid;
end $$;

create function public.game_join(invitation_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms%rowtype; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 select * into r from public.game_rooms where code=upper(trim(invitation_code)) and expires_at>now() and status in ('waiting','playing','finished') for update;
 if r.id is null then raise exception 'Code invalide ou salon expiré'; end if;
 if r.event_id is not null and not game_private.event_member(r.event_id,uid) then raise exception 'Ce salon est réservé aux participants de l’événement'; end if;
 if exists(select 1 from public.game_players where room_id=r.id and user_id=uid and left_at is null) then return r.id; end if;
 if r.status<>'waiting' then raise exception 'La partie est déjà lancée'; end if;
 if (select count(*) from public.game_players where room_id=r.id and left_at is null)>=(r.settings->>'players')::int then raise exception 'Salon complet'; end if;
 insert into public.game_players(room_id,user_id) values(r.id,uid) on conflict(room_id,user_id) do update set left_at=null,ready=false,alive=true,last_seen=now();
 update public.game_rooms set revision=revision+1 where id=r.id;
 return r.id;
end $$;

create function public.game_snapshot(target_room uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.game_rooms%rowtype; result jsonb;
begin
 if not public.game_is_member(target_room) then raise exception 'Salon inaccessible ou expiré'; end if;
 select * into r from public.game_rooms where id=target_room;
 select jsonb_build_object('room',to_jsonb(r),'me',auth.uid(),
 'players',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('name',coalesce(pr.display_name,pr.username,'Membre MyEvent'),'avatar',pr.avatar) order by p.joined_at),'[]') from public.game_players p left join public.profiles pr on pr.id=p.user_id where p.room_id=r.id),
 'round',(select to_jsonb(q) from public.game_rounds q where q.room_id=r.id and q.number=r.round_no),
 'secret',(select to_jsonb(s)-'room_id'-'user_id' from game_private.secrets s where s.room_id=r.id and s.round_no=r.round_no and s.user_id=auth.uid()),
 'vote',(select v.target from game_private.votes v join public.game_rounds q on q.room_id=v.room_id and q.number=v.round_no and q.cycle=v.cycle where v.room_id=r.id and v.round_no=r.round_no and v.voter=auth.uid()),
 'scores',(select coalesce(jsonb_agg(to_jsonb(sc)),'[]') from public.game_scores sc where sc.room_id=r.id),
 'events',(select coalesce(jsonb_agg(to_jsonb(ev) order by ev.id),'[]') from (select * from public.game_events where room_id=r.id order by id desc limit 20) ev)) into result;
 return result;
end $$;

create function public.game_my_rooms() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'status',r.status,'round_no',r.round_no,'invited',not exists(select 1 from public.game_players p where p.room_id=r.id and p.user_id=auth.uid() and p.left_at is null)) order by r.created_at desc),'[]')
 from public.game_rooms r where auth.uid() is not null and r.expires_at>now() and r.status<>'closed' and
 (exists(select 1 from public.game_players p where p.room_id=r.id and p.user_id=auth.uid() and p.left_at is null)
 or (r.status='waiting' and exists(select 1 from public.game_invitations i where i.room_id=r.id and i.user_id=auth.uid())))
$$;

create function public.game_contacts(target_room uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare eid uuid;
begin
 if not public.game_is_member(target_room) then raise exception 'Accès refusé'; end if;
 select event_id into eid from public.game_rooms where id=target_room;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.display_name,p.username,'Membre MyEvent'),'avatar',p.avatar)),'[]') from public.profiles p
 where p.id<>auth.uid() and not exists(select 1 from public.game_players gp where gp.room_id=target_room and gp.user_id=p.id and gp.left_at is null)
 and ((eid is not null and game_private.event_member(eid,p.id)) or (eid is null and public.are_friends(auth.uid(),p.id))));
end $$;

create function public.game_action(target_room uuid, action text, data jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms%rowtype; q public.game_rounds%rowtype; p public.game_players%rowtype; s game_private.secrets%rowtype;
 uid uuid:=auth.uid(); target uuid; next_host uuid; eligible int; current_speaker uuid;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 select * into r from public.game_rooms where id=target_room for update;
 if r.id is null or not public.game_is_member(r.id) then raise exception 'Salon inaccessible ou expiré'; end if;
 select * into p from public.game_players where room_id=r.id and user_id=uid;
 select * into q from public.game_rounds where room_id=r.id and number=r.round_no;
 select * into s from game_private.secrets where room_id=r.id and round_no=r.round_no and user_id=uid;
 if action in ('start','advance','replay','power') and (data->>'revision')::bigint is distinct from r.revision then raise exception 'La partie a évolué. Réessaie.'; end if;
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
   if (select count(*) from public.game_players where room_id=r.id and left_at is null)<4 or exists(select 1 from public.game_players where room_id=r.id and left_at is null and not ready) then raise exception 'Il faut au moins quatre joueurs, tous prêts'; end if;
   perform game_private.start_round(r.id);
 elsif action='reveal' then
   if r.status<>'playing' or q.phase<>'reveal' then raise exception 'Révélation terminée'; end if;
   update public.game_players set revealed=true where room_id=r.id and user_id=uid;
   if not exists(select 1 from public.game_players where room_id=r.id and left_at is null and not revealed) then
     update public.game_rounds set phase='clues',deadline=now()+interval '30 seconds' where room_id=r.id and number=r.round_no;
   end if;
 elsif action='vote' then
   target:=(data->>'target')::uuid;
   if r.status<>'playing' or q.phase<>'voting' or now()>=q.deadline or not p.alive or coalesce(s.silence_cycle,0)=q.cycle or target=uid or target is null
     or not exists(select 1 from public.game_players where room_id=r.id and user_id=target and alive and left_at is null) then raise exception 'Vote non autorisé'; end if;
   if exists(select 1 from game_private.votes where room_id=r.id and round_no=r.round_no and cycle=q.cycle and voter=uid) then raise exception 'Ton vote est déjà enregistré'; end if;
   insert into game_private.votes values(r.id,r.round_no,q.cycle,uid,target,case when s.double_cycle=q.cycle then 2 else 1 end);
   perform game_private.resolve_vote(r.id);
 elsif action='power' then
   target:=coalesce((data->>'target')::uuid,uid);
   if r.status<>'playing' or q.phase<>'discussion' or not p.alive or s.power is null or s.power_used then raise exception 'Pouvoir indisponible'; end if;
   if not exists(select 1 from public.game_players where room_id=r.id and user_id=target and alive and left_at is null) then raise exception 'Cible invalide'; end if;
   if s.power='immunity' then update game_private.secrets set shield_cycle=q.cycle where room_id=r.id and round_no=r.round_no and user_id=uid;
   elsif s.power='double_vote' then update game_private.secrets set double_cycle=q.cycle where room_id=r.id and round_no=r.round_no and user_id=uid;
   elsif s.power='protection' then
     if target=uid then raise exception 'Protège un autre joueur'; end if;
     update game_private.secrets set shield_cycle=q.cycle where room_id=r.id and round_no=r.round_no and user_id=target;
   elsif s.power='silence' then
     if target=uid then raise exception 'Choisis un autre joueur'; end if;
     select count(*) into eligible from game_private.secrets sec join public.game_players gp on gp.room_id=sec.room_id and gp.user_id=sec.user_id where sec.room_id=r.id and sec.round_no=r.round_no and gp.alive and gp.left_at is null and coalesce(sec.silence_cycle,0)<>q.cycle;
     if eligible<=2 or exists(select 1 from game_private.secrets where room_id=r.id and round_no=r.round_no and user_id=target and silence_cycle=q.cycle) then raise exception 'Au moins deux joueurs doivent pouvoir voter'; end if;
     update game_private.secrets set silence_cycle=q.cycle where room_id=r.id and round_no=r.round_no and user_id=target;
   elsif s.power='second_clue' then
     if target=uid then raise exception 'Demande un indice à un autre joueur'; end if;
     update public.game_rounds set phase='extra_clue',extra_target=target,deadline=now()+interval '30 seconds' where room_id=r.id and number=r.round_no;
   else raise exception 'Pouvoir inconnu'; end if;
   update game_private.secrets set power_used=true where room_id=r.id and round_no=r.round_no and user_id=uid;
   insert into public.game_events(room_id,kind,actor_id,payload) values(r.id,'power',uid,jsonb_build_object('power',s.power,'target',target,'round',r.round_no,'cycle',q.cycle));
 elsif action='claim_mission' then
   if r.status<>'playing' or q.phase in ('reveal','round_end') or not p.alive or s.mission is null then raise exception 'Mission indisponible'; end if;
   update game_private.secrets set mission_claimed=true where room_id=r.id and round_no=r.round_no and user_id=uid;
 elsif action='approve_mission' then
   target:=(data->>'target')::uuid;
   if q.phase<>'round_end' or target is null or target=uid or (uid<>r.host_id and target<>r.host_id) then raise exception 'Validation réservée à l’hôte (ou un témoin pour l’hôte)'; end if;
   update game_private.secrets set mission_approved_by=uid where room_id=r.id and round_no=r.round_no and user_id=target and mission_claimed and mission_approved_by is null;
   if not found then raise exception 'Mission non déclarée ou déjà validée'; end if;
   insert into public.game_scores(room_id,round_no,user_id,reason,points) values(r.id,r.round_no,target,'mission',2) on conflict do nothing;
 elsif action='advance' then
   if r.status<>'playing' then raise exception 'Partie non active'; end if;
   current_speaker:=case when q.phase='extra_clue' then q.extra_target else q.speaker_order[q.turn_index] end;
   if q.phase in ('clues','extra_clue') then
     if uid<>current_speaker and uid<>r.host_id and now()<q.deadline then raise exception 'Attends ton tour'; end if;
     if q.phase='extra_clue' or q.turn_index>=cardinality(q.speaker_order) then update public.game_rounds set phase='discussion',deadline=null,extra_target=null where room_id=r.id and number=r.round_no;
     else update public.game_rounds set turn_index=turn_index+1,deadline=now()+interval '30 seconds' where room_id=r.id and number=r.round_no; end if;
   elsif q.phase='voting' then
     if now()<q.deadline then raise exception 'Le vote est encore ouvert'; end if;
     perform game_private.resolve_vote(r.id);
   else
     if uid<>r.host_id then raise exception 'Seul l’hôte peut avancer'; end if;
     if q.phase='discussion' then update public.game_rounds set phase='voting',deadline=now()+interval '90 seconds' where room_id=r.id and number=r.round_no;
     elsif q.phase='result' then
       update public.game_rounds set phase='clues',cycle=cycle+1,turn_index=1,speaker_order=(select array_agg(user_id order by random()) from public.game_players where room_id=r.id and alive and left_at is null),deadline=now()+interval '30 seconds',result='{}' where room_id=r.id and number=r.round_no;
     elsif q.phase='round_end' then
       if r.round_no>=(r.settings->>'rounds')::int or (select count(*) from public.game_players where room_id=r.id and left_at is null)<4 then update public.game_rooms set status='finished' where id=r.id;
       else perform game_private.start_round(r.id); end if;
     else raise exception 'Attends que chaque joueur ait vu son mot'; end if;
   end if;
 elsif action='replay' then
   if uid<>r.host_id or r.status<>'finished' then raise exception 'Rejouer indisponible'; end if;
   -- A replay is a new match in the same room. Previous scores are cleared explicitly.
   delete from public.game_rounds where room_id=r.id;
   delete from public.game_scores where room_id=r.id;
   delete from game_private.secrets where room_id=r.id;
   delete from game_private.votes where room_id=r.id;
   delete from public.game_events where room_id=r.id;
   -- Preserve the latest pair so replay cannot repeat the previous round's words.
   delete from game_private.used_pairs where room_id=r.id and pair_id<>(select pair_id from game_private.used_pairs where room_id=r.id order by used_at desc limit 1);
   update public.game_rooms set status='waiting',round_no=0,expires_at=now()+interval '24 hours' where id=r.id;
   update public.game_players set ready=false,alive=true,revealed=false where room_id=r.id;
 elsif action in ('leave','remove_absent') then
   target:=uid;
   if action='remove_absent' then
     target:=(data->>'target')::uuid;
     if r.host_id<>uid or target is null or target=uid or not exists(select 1 from public.game_players where room_id=r.id and user_id=target and left_at is null and last_seen<now()-interval '2 minutes') then raise exception 'Seul un joueur absent depuis deux minutes peut être retiré par l’hôte'; end if;
   end if;
   update public.game_players set left_at=now(),alive=false,ready=false where room_id=r.id and user_id=target;
   if q.phase='reveal' then update public.game_rounds set speaker_order=array_remove(speaker_order,target) where room_id=r.id and number=r.round_no; end if;
   select user_id into next_host from public.game_players where room_id=r.id and left_at is null order by joined_at limit 1;
   if next_host is null then update public.game_rooms set status='closed' where id=r.id;
   else
     if r.host_id=target then update public.game_rooms set host_id=next_host where id=r.id; end if;
     if r.status='playing' and q.phase<>'round_end' then
       if not game_private.check_winner(r.id) then
         if q.phase='voting' then perform game_private.resolve_vote(r.id);
         elsif q.phase='reveal' and not exists(select 1 from public.game_players where room_id=r.id and left_at is null and not revealed) then
           update public.game_rounds set phase='clues',speaker_order=array_remove(speaker_order,target),deadline=now()+interval '30 seconds' where room_id=r.id and number=r.round_no;
         elsif q.phase in ('clues','extra_clue') then
           -- Restart the surviving speakers to avoid a skipped or dangling index.
           update public.game_rounds set phase='clues',speaker_order=array_remove(speaker_order,target),turn_index=1,extra_target=null,deadline=now()+interval '30 seconds' where room_id=r.id and number=r.round_no;
         end if;
       end if;
     end if;
   end if;
 elsif action='claim_host' then
   if r.host_id=uid or exists(select 1 from public.game_players where room_id=r.id and user_id=r.host_id and left_at is null and last_seen>now()-interval '2 minutes') then raise exception 'L’hôte est encore présent'; end if;
   update public.game_rooms set host_id=uid where id=r.id;
 else raise exception 'Action inconnue'; end if;
 update public.game_rooms set revision=revision+1 where id=r.id;
end $$;

-- Expired room deletion cascades to every public and secret record. Service-only cron hook.
create function public.game_cleanup_expired() returns bigint
language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 delete from public.game_rooms where expires_at<now(); get diagnostics n=row_count; return n;
end $$;
revoke all on all functions in schema game_private from public,anon,authenticated;
revoke all on function public.game_create(jsonb,uuid),public.game_join(text),public.game_snapshot(uuid),public.game_action(uuid,text,jsonb),public.game_my_rooms(),public.game_contacts(uuid),public.game_cleanup_expired() from public,anon,authenticated;
grant execute on function public.game_create(jsonb,uuid),public.game_join(text),public.game_snapshot(uuid),public.game_action(uuid,text,jsonb),public.game_my_rooms(),public.game_contacts(uuid) to authenticated;
grant execute on function public.game_cleanup_expired() to service_role;
-- Only non-secret room revisions are replicated. Polling remains a fallback.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_rooms') then
   alter publication supabase_realtime add table public.game_rooms;
 end if;
end $$;
-- Supabase Cron is optional: schedule automatic cleanup only when already enabled.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   execute $cron$select cron.schedule('myevent-games-cleanup','17 * * * *','select public.game_cleanup_expired()')$cron$;
 end if;
end $$;
commit;
