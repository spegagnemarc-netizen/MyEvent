// Exercise the applied migrations with distinct authenticated roles in isolated PostgreSQL.
import assert from 'node:assert/strict';
import {setup,users,as,rpc} from './games-db.mjs';

const db=await setup();
const [a,b,stranger]=users;
let checks=0;
const denied=async operation=>{await assert.rejects(operation);checks++;};
try {
  await denied(()=>rpc(db,null,'create_friend_invite'));
  const invalid='99999999-9999-4999-8999-999999999999';
  assert.equal((await as(db,b,'select * from public.friend_invite_preview($1)',[invalid])).rows.length,0);checks++;
  await denied(()=>rpc(db,b,'accept_friend_invite',{invitation:invalid}));

  const expired=await rpc(db,a,'create_friend_invite');
  await db.query("update public.friend_invites set expires_at=now()-interval '1 second' where token=$1",[expired]);
  assert.equal((await as(db,b,'select * from public.friend_invite_preview($1)',[expired])).rows.length,0);checks++;
  await denied(()=>rpc(db,b,'accept_friend_invite',{invitation:expired}));

  const token=await rpc(db,a,'create_friend_invite');
  await denied(()=>rpc(db,a,'accept_friend_invite',{invitation:token}));
  assert.equal((await as(db,a,'select * from public.friend_invite_preview($1)',[token])).rows.length,0);checks++;
  const profile=(await as(db,b,'select * from public.friend_invite_preview($1)',[token])).rows[0];
  assert.equal(profile.id,a);assert.equal(profile.display_name,'Marc');checks+=2;
  await denied(()=>as(db,b,'select * from public.friend_invites'));
  await denied(()=>as(db,b,"insert into public.friendships(user_low,user_high,requester,status) values($1,$2,$1,'accepted')",[a,b]));

  await rpc(db,b,'friend_action',{other_id:a,action:'send'});
  assert.equal((await as(db,b,'select status from public.friendships')).rows[0].status,'pending');checks++;
  assert.equal(await rpc(db,b,'accept_friend_invite',{invitation:token}),a);checks++;
  for(const person of [a,b]) {assert.equal((await as(db,person,'select status from public.friendships')).rows[0].status,'accepted');checks++;}
  assert.equal((await as(db,stranger,'select * from public.friendships')).rows.length,0);checks++;
  await denied(()=>rpc(db,stranger,'accept_friend_invite',{invitation:token}));

  const again=await rpc(db,a,'create_friend_invite');
  assert.equal((await as(db,b,'select * from public.friend_invite_preview($1)',[again])).rows.length,1);checks++;
  await rpc(db,b,'accept_friend_invite',{invitation:again});
  assert.equal((await as(db,b,'select * from public.friendships')).rows.length,1);checks++;
  await rpc(db,a,'friend_action',{other_id:b,action:'remove'});
  assert.equal((await as(db,b,'select * from public.friendships')).rows.length,0);checks++;
  console.log(`PASS: ${checks} checks — invalid/expired/self/reused links, pending request, existing friendship, RLS and persistence`);
} finally { await db.close(); }
