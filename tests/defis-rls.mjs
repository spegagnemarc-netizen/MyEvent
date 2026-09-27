import assert from 'node:assert/strict';
import {setup,users,as,rpc} from './games-db.mjs';

const db=await setup();let checks=0;
const ok=value=>{assert.ok(value);checks++;};
const call=(i,name,args)=>rpc(db,users[i],name,args);
const snap=(i,rid)=>call(i,'defis_snapshot',{target_room:rid});
const act=async(i,rid,action,data={})=>call(i,'defis_action',{target_room:rid,action,data:{revision:(await snap(i,rid)).room.revision,...data}});
const denied=async fn=>{await assert.rejects(fn);checks++;};

try{
  const rid=await call(0,'defis_create',{options:{players:4,challenges:5}});
  let s=await snap(0,rid);
  ok(s.room.game_key==='defis'&&s.room.status==='waiting');
  const code=s.room.code;
  for(let i=1;i<4;i++)await call(i,'defis_join',{invitation_code:code});
  ok(await call(1,'defis_join',{invitation_code:code})===rid);
  await denied(()=>snap(7,rid));
  await denied(()=>as(db,users[0],"update public.game_challenges set status='completed' where room_id=$1",[rid]));
  await denied(()=>as(db,users[0],"insert into public.game_scores(room_id,round_no,user_id,reason,points) values($1,1,$2,'cheat',999)",[rid,users[0]]));
  for(let i=0;i<4;i++)await act(i,rid,'ready',{ready:true});
  await denied(()=>act(1,rid,'start'));
  await act(0,rid,'start');
  s=await snap(0,rid);
  ok(s.room.status==='playing'&&s.challenge.number===1&&s.challenge.kind==='individual'&&s.challenge.target_id);
  await denied(()=>act(1,rid,'complete'));
  const firstTarget=s.challenge.target_id;
  await act(0,rid,'complete');
  s=await snap(0,rid);
  ok(s.challenge.number===2&&s.progress.done===1);
  ok(s.scores.some(x=>x.user_id===firstTarget&&x.reason==='defi_1'&&x.points===2));
  await act(0,rid,'skip');
  s=await snap(0,rid);
  ok(s.challenge.number===3&&s.challenge.kind==='collective'&&s.progress.done===2);
  await act(0,rid,'complete');
  s=await snap(0,rid);
  ok(s.progress.done===3);
  ok([0,1,2,3].every(i=>s.scores.some(x=>x.user_id===users[i]&&x.reason==='defi_3'&&x.points===1)));
  while((await snap(0,rid)).room.status==='playing')await act(0,rid,'complete');
  s=await snap(0,rid);
  ok(s.room.status==='finished'&&s.challenge===null);
  await denied(()=>call(4,'defis_join',{invitation_code:code}));
  await act(0,rid,'replay');
  s=await snap(0,rid);
  ok(s.room.status==='waiting'&&s.scores.length===0&&s.progress.total===0&&s.players.every(p=>!p.ready));

  const eid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.query('insert into public.events values($1,$2)',[eid,users[0]]);
  const eventRoom=await call(0,'defis_create',{target_event:eid,options:{players:2,challenges:3}});
  await denied(async()=>call(1,'defis_join',{invitation_code:(await snap(0,eventRoom)).room.code}));
  await db.query('insert into public.event_members values($1,$2)',[eid,users[1]]);
  ok(await call(1,'defis_join',{invitation_code:(await snap(0,eventRoom)).room.code})===eventRoom);
  const contacts=await call(0,'defis_contacts',{target_room:eventRoom});
  ok(Array.isArray(contacts));
  console.log(`PASS: ${checks} Defis MyEvent multiplayer checks`);
}finally{await db.close();}
