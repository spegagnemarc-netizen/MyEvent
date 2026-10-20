// Only the new V4 access policy. No replay of the previous majority or integration suites.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {fixture} from '../scripts/activities-test-fixture.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('NEW POLICY ONLY: general access without adult proof, protected participation and restricted outings',async()=>{
 const db=new PGlite(),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(fixture);await db.exec(await read('docs/production-v1/002-install-closed-corrected.sql'));
  const policies=(await db.query("select tablename,policyname,qual,with_check from pg_policies where schemaname='activities_private' order by tablename,policyname")).rows;
  await db.exec(await read('docs/majority/004-inclusive-activities-proposal.sql'));
  assert.deepEqual((await db.query("select tablename,policyname,qual,with_check from pg_policies where schemaname='activities_private' order by tablename,policyname")).rows,policies);
  assert.deepEqual((await db.query('select enabled,registrations_enabled from activities_private.settings')).rows,[{enabled:false,registrations_enabled:false}]);
  await db.query('insert into auth.users values($1),($2)',[A,B]);await db.query("insert into public.profiles values($1,'A'),($2,'B')",[A,B]);await db.query('insert into activities_private.adult_access(user_id,approved_by) values($1,$1)',[A]);
  await db.exec('update activities_private.settings set enabled=true,registrations_enabled=true');
  const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const rpc=async(n,args=[])=> (await db.query(`select public.${n}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as r`,args)).rows[0].r;
  const base={title:'Ordinary',description:'Public place only',category:'bowling',activity_type:'bowling',starts_at:'2099-01-01T12:00:00Z',city:'Gap',venue:'Public',address:'Precise meeting point',latitude:44.5567,longitude:6.0867,capacity:8,visibility:'public',join_mode:'direct',cost_mode:'free',venue_cost_status:'unknown',adults_only:false};
  await as(A);const general=await rpc('activities_save',[null,base]);const restricted=await rpc('activities_save',[null,{...base,adults_only:true}]);
  await as(B);const cap=await rpc('activities_capabilities');assert.equal(cap.account_access,true);assert.equal(cap.adult_access,false);assert.equal(cap.can_create,true);assert.equal(cap.can_participate,true);
  assert.equal(await rpc('activities_detail',[restricted]),null);assert.equal((await rpc('activities_list')).some(x=>x.id===restricted),false);
  await assert.rejects(rpc('activities_participate',[restricted,'join',null]),/inaccessible/);
  await rpc('activities_participate',[general,'join',null]);assert.equal((await rpc('activities_detail',[general])).membership,'pending');
  await as(A);await rpc('activities_participate',[general,'accept',B]);await as(B);
  const accepted=await rpc('activities_detail',[general]);assert.equal(accepted.membership,'accepted');assert.equal(accepted.address,null);assert.equal(accepted.position.lat,44.56);
  await rpc('activities_save',[null,{...base,title:'Created without adult proof'}]);
  await assert.rejects(rpc('activities_save',[null,{...base,adults_only:true}]),/réservée aux adultes/);
  await assert.rejects(rpc('activities_save',[null,{...base,category:'autres',activity_type:'aperitif'}]),/réservée aux adultes/);
  await as(A);await assert.rejects(rpc('activities_save',[restricted,{...base,adults_only:false}]),/restriction adulte/);
  await db.exec('reset role');await db.query('update activities_private.adult_access set revoked_at=now() where user_id=$1',[A]);await as(A);
  assert.equal((await rpc('activities_capabilities')).can_create,true);assert.equal(await rpc('activities_detail',[restricted]),null);
  await assert.rejects(db.query('select * from activities_private.activities'),/permission denied/);
 }finally{await db.close();}
});
