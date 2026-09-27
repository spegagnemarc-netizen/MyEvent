import assert from 'node:assert/strict';
import {setup,users,as,rpc} from './games-db.mjs';
const db=await setup();let checks=0;
const ok=(value)=>{assert.ok(value);checks++;};
const call=(i,name,args)=>rpc(db,users[i],name,args);
const snap=(i,rid)=>call(i,'game_snapshot',{target_room:rid});
const act=async(i,rid,action,data={})=>call(i,'game_action',{target_room:rid,action,data:{revision:(await snap(i,rid)).room.revision,...data}});
const denied=async(fn)=>{await assert.rejects(fn);checks++;};
async function room(mode='classic',rounds=2,count=4){
 const id=await call(0,'game_create',{options:{players:count,rounds,mode,infiltrators:1}});
 const code=(await snap(0,id)).room.code;
 for(let i=1;i<count;i++)await call(i,'game_join',{invitation_code:code});
 for(let i=0;i<count;i++)await act(i,id,'ready',{ready:true});
 await act(0,id,'start'); return id;
}
async function discussion(id,count=4){
 for(let i=0;i<count;i++)await act(i,id,'reveal');
 for(let i=0;i<count;i++)await act(0,id,'advance');
 ok((await snap(0,id)).round.phase==='discussion');
}
try{
 // Invitations are one-use, transactional, real friendships, visible to both members only.
 const token=await call(0,'create_friend_invite');
 await denied(()=>call(0,'accept_friend_invite',{invitation:token}));
 ok((await as(db,users[1],'select * from public.friend_invite_preview($1)',[token])).rows[0].id===users[0]);
 await call(1,'accept_friend_invite',{invitation:token});
 for(const i of [0,1])ok((await as(db,users[i],'select status from public.friendships')).rows[0].status==='accepted');
 ok((await as(db,users[2],'select * from public.friendships')).rows.length===0);
 await denied(()=>call(2,'accept_friend_invite',{invitation:token}));
 const id=await room();
 await denied(()=>snap(7,id));
 await denied(()=>as(db,users[0],'select * from game_private.secrets'));
 await denied(()=>as(db,users[0],'select * from game_private.word_pairs'));
 await denied(()=>as(db,users[0],'select game_private.start_round($1)',[id]));
 await denied(()=>as(db,users[0],"update public.game_rooms set host_id=$1 where id=$2",[users[1],id]));
 await denied(()=>as(db,users[0],"insert into public.game_scores(room_id,round_no,user_id,reason,points) values($1,1,$2,'cheat',999)",[id,users[0]]));
 await denied(()=>as(db,null,'select public.game_my_rooms()',[],'anon'));
 ok((await as(db,users[7],'select * from public.game_players')).rows.length===0);
 const states=await Promise.all([0,1,2,3].map(i=>snap(i,id)));
 ok(states.filter(x=>x.secret.role==='infiltrator').length===1);
 ok(states.every(x=>!JSON.stringify(x.players).includes('word')&&!JSON.stringify(x.room).includes('word')));
 const code=states[0].room.code;
 ok(await call(1,'game_join',{invitation_code:code})===id);
 await denied(()=>call(4,'game_join',{invitation_code:code}));
 await denied(()=>act(1,id,'advance'));
 await discussion(id);
 await act(0,id,'advance');
 await denied(()=>act(0,id,'vote',{target:users[0]}));
 await denied(()=>act(0,id,'vote',{target:users[7]}));
 const bad=states.findIndex(x=>x.secret.role==='infiltrator');
 const good=states.findIndex(x=>x.secret.role==='citizen');
 await act(good,id,'vote',{target:users[bad]});
 await denied(()=>act(good,id,'vote',{target:users[bad]}));
 const other=states.findIndex((_,i)=>i!==good);
 ok((await snap(other,id)).vote===null);
 await denied(()=>as(db,users[other],'select * from game_private.votes'));
 for(let i=0;i<4;i++)if(i!==good)await act(i,id,'vote',{target:users[i===bad?good:bad]});
 let final=await snap(0,id);
 ok(final.round.phase==='round_end'&&final.round.result.winner==='citizen');
 ok(final.round.result.roles.length===4&&final.scores.length>0);
 const word=final.secret.word,role=final.secret.role;
 await act(0,id,'advance');
 ok((await snap(0,id)).room.round_no===2);
 ok((await snap(0,id)).secret.word!==word || (await snap(0,id)).secret.role!==role);
 await act(0,id,'leave');
 ok((await snap(1,id)).room.host_id===users[1]);
 await denied(()=>snap(0,id));
 // Ties do not eliminate, vote timeout uses server time, stale progression fails.
 const tie=await room();await discussion(tie);await act(0,tie,'advance');
 for(let i=0;i<4;i++)await act(i,tie,'vote',{target:users[(i+1)%4]});
 ok((await snap(0,tie)).round.result.tie===true);
 ok((await snap(0,tie)).players.every(p=>p.alive));
 const rev=(await snap(0,tie)).room.revision;
 await act(0,tie,'advance');
 await denied(()=>call(0,'game_action',{target_room:tie,action:'advance',data:{revision:rev}}));
 for(let i=0;i<4;i++)await act(0,tie,'advance');await act(0,tie,'advance');
 await db.query("update public.game_rounds set deadline=now()-interval '1 second' where room_id=$1",[tie]);
 await act(1,tie,'advance');ok((await snap(0,tie)).round.phase==='result');
 // Every power is server-enforced and single-use. Test fixture sets deterministic allocation.
 const power=await room('myevent',1,6);await discussion(power,6);
 for(const [i,p] of ['immunity','double_vote','protection','silence','second_clue'].entries())await db.query('update game_private.secrets set power=$1 where room_id=$2 and user_id=$3',[p,power,users[i]]);
 await act(0,power,'power');await denied(()=>act(0,power,'power'));
 await act(1,power,'power');await act(2,power,'power',{target:users[3]});await act(3,power,'power',{target:users[4]});
 await act(4,power,'power',{target:users[5]});ok((await snap(0,power)).round.phase==='extra_clue');
 await act(5,power,'advance');await act(1,power,'claim_mission');await act(0,power,'advance');
 await denied(()=>act(4,power,'vote',{target:users[0]}));
 for(let i=0;i<6;i++)if(i!==4)await act(i,power,'vote',{target:users[i===0?1:0]});
 ok((await snap(0,power)).round.result.protected===true);
 ok((await snap(0,power)).players.find(p=>p.user_id===users[0]).alive);
 const weighted=await db.query('select weight from game_private.votes where room_id=$1 and voter=$2',[power,users[1]]);ok(weighted.rows[0].weight===2);
 await db.query("select game_private.finish_round($1,'citizen')",[power]);
 await denied(()=>act(1,power,'approve_mission',{target:users[1]}));
 await act(0,power,'approve_mission',{target:users[1]});await denied(()=>act(0,power,'approve_mission',{target:users[1]}));
 ok((await snap(0,power)).scores.filter(x=>x.reason==='mission').length===1);
 await act(0,power,'advance');ok((await snap(0,power)).room.status==='finished');
 await act(0,power,'replay');ok((await snap(0,power)).room.status==='waiting'&&(await snap(0,power)).scores.length===0);
 // Rejoin is idempotent; readiness, ownership and capacity are authoritative.
 await denied(()=>act(1,power,'start'));
 await denied(()=>act(0,power,'start'));
 await denied(async()=>call(6,'game_join',{invitation_code:(await snap(0,power)).room.code}));
 await denied(()=>act(1,power,'claim_host'));
 await denied(()=>act(0,power,'remove_absent',{target:users[1]}));
 await db.query("update public.game_players set last_seen=now()-interval '3 minutes' where room_id=$1 and user_id=$2",[power,users[0]]);
 await act(1,power,'claim_host');ok((await snap(1,power)).room.host_id===users[1]);
 await denied(()=>act(2,power,'remove_absent',{target:users[0]}));
 await act(1,power,'remove_absent',{target:users[0]});await denied(()=>snap(0,power));
 await call(0,'game_join',{invitation_code:(await snap(1,power)).room.code});
 ok((await snap(0,power)).players.filter(p=>p.user_id===users[0]).length===1);
 for(let i=0;i<6;i++)await act(i,power,'ready',{ready:true});
 await act(1,power,'start');ok((await snap(0,power)).round.phase==='reveal');
 await denied(()=>act(1,power,'power'));
 await denied(()=>act(0,power,'vote',{target:users[1]}));
 // A player departing before others reveal must never remain in the speaker queue.
 let leaving=2;while((await snap(leaving,power)).secret.role!=='citizen')leaving++;
 await act(leaving,power,'leave');
 for(const i of [0,1,2,3,4,5].filter(i=>i!==leaving)){if((await snap(i,power)).round.phase==='reveal')await act(i,power,'reveal');}
 ok(!(await snap(0,power)).round.speaker_order.includes(users[leaving]));
 // Event room admission is checked server-side; custom words never enter room settings.
 const eid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';await db.query('insert into public.events values($1,$2)',[eid,users[0]]);
 const eventRoom=await call(0,'game_create',{target_event:eid,options:{rounds:1,pairs:[['Nuage','Brume']]}});
 ok(!(JSON.stringify((await snap(0,eventRoom)).room).includes('Nuage')));
 await denied(async()=>call(1,'game_join',{invitation_code:(await snap(0,eventRoom)).room.code}));
 await denied(()=>call(1,'game_create',{target_event:eid}));
 await db.query('insert into public.event_members values($1,$2)',[eid,users[1]]);
 ok((await call(0,'game_contacts',{target_room:eventRoom})).some(x=>x.id===users[1]));
 await db.query("update public.game_rooms set expires_at=now()-interval '1 second' where id=$1",[eventRoom]);
 await denied(()=>snap(0,eventRoom));
 await denied(()=>call(0,'game_cleanup_expired'));
 await as(db,null,'select public.game_cleanup_expired()',[],'service_role');
 ok((await db.query('select * from game_private.word_pairs where room_id=$1',[eventRoom])).rows.length===0);
 console.log(`PASS: ${checks} games and friends checks (real isolated PostgreSQL, 8 identities)`);
}finally{await db.close();}
