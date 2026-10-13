-- TEST ONLY, executes real PostgreSQL RPCs under authenticated roles with fictitious identities.
-- Claims are emulated by SQL; this is not a multi-browser OAuth test. No tokens or passwords.
-- Substituted UUIDs must belong to the existing TEST accounts, never real users.
begin;
create temporary table ore_results(game text,checks int,status text,room_id uuid) on commit preserve rows;
create function pg_temp.ore_rpc(who uuid,fn text,args jsonb default '{}') returns jsonb language plpgsql as $$
declare params text;res jsonb;oldsub text:=current_setting('request.jwt.claim.sub',true);oldclaims text:=current_setting('request.jwt.claims',true);
begin
 if fn !~ '^(game|defis|activity)_[a-z_]+$' then raise exception 'RPC not permitted';end if;
 select string_agg(format('%I=>%L::%s',k,args->>k,format_type(p.proargtypes[array_position(p.proargnames,k)-1],null)),',') into params
 from jsonb_object_keys(args) k cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=fn;
 perform set_config('request.jwt.claim.sub',who::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin
  execute format('select to_jsonb(public.%I(%s))',fn,coalesce(params,'')) into res;
 exception when others then
  execute 'reset role';perform set_config('request.jwt.claim.sub',coalesce(oldsub,''),true);perform set_config('request.jwt.claims',coalesce(oldclaims,''),true);raise;
 end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',coalesce(oldsub,''),true);perform set_config('request.jwt.claims',coalesce(oldclaims,''),true);
 return res;
end $$;
create function pg_temp.ore_snap(who uuid,prefix text,rid uuid) returns jsonb language sql as $$select pg_temp.ore_rpc(who,prefix||'_snapshot',jsonb_build_object('target_room',rid))$$;
create function pg_temp.ore_act(who uuid,prefix text,rid uuid,action text,data jsonb default '{}') returns void language plpgsql as $$
declare s jsonb;
begin
 s:=pg_temp.ore_snap(who,prefix,rid);
 perform pg_temp.ore_rpc(who,prefix||'_action',jsonb_build_object('target_room',rid,'action',action,'data',jsonb_build_object('revision',s->'room'->'revision','round_no',s->'room'->'round_no')||data));
end $$;
create function pg_temp.ore_denied(who uuid,fn text,args jsonb) returns boolean language plpgsql as $$
begin perform pg_temp.ore_rpc(who,fn,args);return false;exception when others then return true;end $$;
DO $$
declare ids uuid[]:=array['4550a11d-0971-4ea5-b527-c6ceeb170781','cfd3f5c6-afd7-46a5-890e-d1e8ad14102c','ef765c32-b78d-49ab-8750-50cfe57af686','665a6cf4-228b-4307-b7b5-92a6d68370d3']::uuid[];
 outsider uuid:='864beda0-b216-4b9a-9697-4dc8fd8c41f9';rid uuid;code text;key text;prefix text;opts jsonb;s jsonb;u uuid;actor uuid;bad uuid;good uuid;checks int;round_no int;expected text;stale bigint;
begin
 if (select count(*) from auth.users where id=any(ids) and email like 'test-%@example.com')<>4 then raise exception 'Fictitious TEST accounts not confirmed';end if;
 insert into public.friendships(user_low,user_high,requester,status)
 values(least(ids[1],ids[2]),greatest(ids[1],ids[2]),ids[1],'accepted')
 on conflict(user_low,user_high) do update set status='accepted',updated_at=now();
 foreach key in array array['infiltre','defis','truth','treasure','quiz','blind'] loop
  checks:=0;prefix:=case when key='infiltre' then 'game' when key='defis' then 'defis' else 'activity' end;
  opts:=jsonb_build_object('players',4,'rounds',case when key='infiltre' then 1 else 2 end,'mode','classic','infiltrators',1,'challenges',3);
  if prefix='activity' then opts:=opts||jsonb_build_object('game_key',key);end if;
  if key='treasure' then opts:=opts||'{"items":[{"prompt":"Indice fictif : couleur du logo.","answer":"orange"},{"prompt":"Indice fictif : couleur du fond.","answer":"noir"}]}'::jsonb;end if;
  if key in ('quiz','blind') then opts:=opts||'{"items":[{"prompt":"Question fictive 1","choices":["A","B","C","D"],"answer":"0","audio_url":"https://example.org/extrait.mp3"},{"prompt":"Question fictive 2","choices":["A","B","C","D"],"answer":"1","audio_url":"https://example.org/extrait2.mp3"}]}'::jsonb;end if;
  rid:=(pg_temp.ore_rpc(ids[1],prefix||'_create',jsonb_build_object('options',opts))#>>'{}')::uuid;
  s:=pg_temp.ore_snap(ids[1],prefix,rid);code:=s->'room'->>'code';
  assert s->'room'->>'status'='waiting';checks:=checks+1;
  assert pg_temp.ore_denied(outsider,prefix||'_snapshot',jsonb_build_object('target_room',rid));checks:=checks+1;
  perform pg_temp.ore_act(ids[1],prefix,rid,'invite',jsonb_build_object('target',ids[2]));
  assert exists(select 1 from jsonb_array_elements(pg_temp.ore_rpc(ids[2],prefix||'_my_rooms')) x where x->>'code'=code and (x->>'invited')::boolean);checks:=checks+1;
  foreach u in array ids[2:4] loop perform pg_temp.ore_rpc(u,prefix||'_join',jsonb_build_object('invitation_code',code));end loop;
  assert jsonb_array_length(pg_temp.ore_snap(ids[2],prefix,rid)->'players')=4;checks:=checks+1;
  assert pg_temp.ore_denied(ids[1],prefix||'_action',jsonb_build_object('target_room',rid,'action','start','data',jsonb_build_object('revision',(pg_temp.ore_snap(ids[1],prefix,rid)->'room'->'revision'))));checks:=checks+1;
  foreach u in array ids loop perform pg_temp.ore_act(u,prefix,rid,'ready','{"ready":true}');end loop;
  assert pg_temp.ore_denied(ids[2],prefix||'_action',jsonb_build_object('target_room',rid,'action','start','data',jsonb_build_object('revision',(pg_temp.ore_snap(ids[2],prefix,rid)->'room'->'revision'))));checks:=checks+1;
  perform pg_temp.ore_act(ids[1],prefix,rid,'start');
  assert pg_temp.ore_snap(ids[2],prefix,rid)->'room'->>'status'='playing';checks:=checks+1;
  if key='infiltre' then
   foreach u in array ids loop
    s:=pg_temp.ore_snap(u,prefix,rid);
    if s->'secret'->>'role'='infiltrator' then bad:=u;else good:=u;end if;
    assert not ((s->'players')::text like '%"word"%');checks:=checks+1;
    perform pg_temp.ore_act(u,prefix,rid,'reveal');
   end loop;
   for round_no in 1..4 loop perform pg_temp.ore_act(ids[1],prefix,rid,'advance');end loop;
   assert pg_temp.ore_snap(ids[1],prefix,rid)->'round'->>'phase'='discussion';checks:=checks+1;
   perform pg_temp.ore_act(ids[1],prefix,rid,'advance');
   foreach u in array ids loop perform pg_temp.ore_act(u,prefix,rid,'vote',jsonb_build_object('target',case when u=bad then good else bad end));end loop;
   assert pg_temp.ore_snap(ids[1],prefix,rid)->'round'->>'phase'='round_end';checks:=checks+1;
   perform pg_temp.ore_act(ids[1],prefix,rid,'advance');
  elsif key='defis' then
   perform pg_temp.ore_act(ids[1],prefix,rid,'complete');perform pg_temp.ore_act(ids[1],prefix,rid,'skip');perform pg_temp.ore_act(ids[1],prefix,rid,'complete');
  else
   for round_no in 1..2 loop
    s:=pg_temp.ore_snap(ids[1],prefix,rid);assert s->'question'->>'answer' is null;checks:=checks+1;
    if key='truth' then
     actor:=(s->'question'->>'actor')::uuid;
     perform pg_temp.ore_act(actor,prefix,rid,'choose',jsonb_build_object('kind',case when round_no=1 then 'truth' else 'dare' end));
     assert length(pg_temp.ore_snap(actor,prefix,rid)->'question'->>'prompt')>0;checks:=checks+1;
     perform pg_temp.ore_act(actor,prefix,rid,'done');
    elsif key='treasure' then
     perform pg_temp.ore_act(ids[2],prefix,rid,'answer','{"answer":"incorrect"}');
     assert pg_temp.ore_snap(ids[1],prefix,rid)->>'phase'='active';checks:=checks+1;
     perform pg_temp.ore_act(ids[2],prefix,rid,'answer',jsonb_build_object('answer',case when round_no=1 then 'orange' else 'noir' end));
    else
     assert pg_temp.ore_denied(ids[1],prefix||'_action',jsonb_build_object('target_room',rid,'action','answer','data',jsonb_build_object('round_no',round_no-1,'answer','0')));checks:=checks+1;
     foreach u in array ids loop perform pg_temp.ore_act(u,prefix,rid,'answer',jsonb_build_object('answer',case when round_no=1 then '0' else '1' end));end loop;
     assert pg_temp.ore_denied(ids[1],prefix||'_action',jsonb_build_object('target_room',rid,'action','answer','data',jsonb_build_object('round_no',round_no,'answer','0')));checks:=checks+1;
     perform pg_temp.ore_act(ids[1],prefix,rid,'reveal');
     assert pg_temp.ore_snap(ids[2],prefix,rid)->'question'->>'answer'=case when round_no=1 then '0' else '1' end;checks:=checks+1;
    end if;
    perform pg_temp.ore_act(ids[1],prefix,rid,'next');
   end loop;
  end if;
  s:=pg_temp.ore_snap(ids[2],prefix,rid);assert s->'room'->>'status'='finished';assert jsonb_array_length(s->'scores')>0;checks:=checks+2;
  assert pg_temp.ore_snap(ids[3],prefix,rid)->'room'->>'status'='finished';checks:=checks+1;
  -- Persist completed rooms and scores; no cleanup/destructive deletions.
  insert into ore_results values(key,checks,'finished / four TEST accounts / invitations verified',rid);
 end loop;
end $$;

-- Permission tests run under the real TEST database roles, no service-key bypass.
DO $$
declare outsider uuid:='864beda0-b216-4b9a-9697-4dc8fd8c41f9';total int;denied boolean;
begin
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into total from public.game_rooms;assert total=0;
 denied:=false;begin perform 1 from game_private.secrets;exception when insufficient_privilege then denied:=true;end;assert denied;
 denied:=false;begin perform 1 from game_private.activity_answers;exception when insufficient_privilege then denied:=true;end;assert denied;
 denied:=false;begin update public.game_rooms set host_id=outsider;exception when insufficient_privilege then denied:=true;end;assert denied;
 denied:=false;begin insert into public.game_scores(room_id,round_no,user_id,reason,points) values(gen_random_uuid(),1,outsider,'cheat',999);exception when insufficient_privilege then denied:=true;end;assert denied;
 execute 'reset role';
 execute 'set local role anon';
 denied:=false;begin perform public.game_my_rooms();exception when insufficient_privilege then denied:=true;end;assert denied;
 execute 'reset role';
 insert into ore_results values('permissions',6,'RLS outsider hidden; secrets, writes and anonymous RPC denied',null);
end $$;

commit;
select game,checks,status,room_id from ore_results order by game;
