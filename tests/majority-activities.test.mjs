import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {fixture} from '../scripts/activities-test-fixture.mjs';
import {majorityVerification} from '../server/majority-verification.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
test('LOCAL database: automatic proof, permissions, closed gate, save/read/join/leave/approval and revocation',async()=>{
 const db=new PGlite();try{
  await db.exec(fixture);await db.exec(await read('docs/production-v1/002-install-closed-corrected.sql'));
  const upgrade=await read('docs/majority/003-automatic-majority-proposal.sql');
  await db.exec(upgrade);
  assert.deepEqual((await db.query('select enabled,registrations_enabled from activities_private.settings')).rows,[{enabled:false,registrations_enabled:false}]);
  await assert.rejects(db.exec(upgrade),/catalogue mismatch/);await db.exec('rollback');
  await db.query('insert into auth.users values($1),($2),($3)',[A,B,C]);await db.query("insert into public.profiles values($1,'A'),($2,'B'),($3,'C')",[A,B,C]);
  const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
  const rpc=async(name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
  await as(A);await assert.rejects(rpc('activities_majority_begin',[A,'a'.repeat(64)]),/permission denied/);
  await db.exec('reset role');await db.query('insert into activities_private.adult_access(user_id,approved_by) values($1,$2)',[C,A]);
  await as(C);assert.equal((await rpc('activities_capabilities')).adult_access,false);
  await db.exec("reset role;update activities_private.adult_access set approved_at=now()-interval '1 day'");
  await as(null,'service_role');await rpc('activities_majority_begin',[C,'c'.repeat(64)]);
  await assert.rejects(rpc('activities_majority_complete',[C,'d'.repeat(64),true]),/mismatch/);
  assert.equal(await rpc('activities_majority_complete',[C,'c'.repeat(64),false]),false);
  assert.equal(await rpc('activities_majority_complete',[C,'c'.repeat(64),true]),false);
  const verify=async(id,key,over18=true)=>{await as(null,'service_role');await rpc('activities_majority_begin',[id,key.repeat(64)]);return rpc('activities_majority_complete',[id,key.repeat(64),over18]);};
  await verify(A,'a');await verify(B,'b');await as(A);
  assert.equal((await rpc('activities_capabilities')).automatic_majority,true);assert.equal((await rpc('activities_capabilities')).can_create,false);
  await db.exec('reset role;update activities_private.settings set enabled=true');await as(A);
  const data={title:'Local only',description:'Local persistence check',category:'bowling',activity_type:'bowling',starts_at:'2099-01-01T12:00:00Z',city:'Gap',venue:'Public',address:'Private address',latitude:44.556,longitude:6.086,capacity:2,visibility:'public',join_mode:'direct',cost_mode:'free',venue_cost_status:'unknown'};
  const id=await rpc('activities_save',[null,data]);assert.equal((await rpc('activities_detail',[id])).members.length,1);
  await as(B);const before=await rpc('activities_detail',[id]);assert.equal(before.address,null);
  await assert.rejects(rpc('activities_participate',[id,'join',null]),/Inscriptions fermées/);
  await db.exec('reset role;update activities_private.settings set registrations_enabled=true');await as(B);
  await rpc('activities_participate',[id,'join',null]);await as(A);await as(B); // new session, real persisted rows
  assert.equal((await rpc('activities_detail',[id])).membership,'accepted');assert.equal((await rpc('activities_detail',[id])).address,'Private address');
  await rpc('activities_participate',[id,'leave',null]);assert.equal((await rpc('activities_detail',[id])).membership,'left');
  await as(A);const approval=await rpc('activities_save',[null,{...data,join_mode:'approval'}]);
  await as(B);await rpc('activities_participate',[approval,'join',null]);await as(A);
  assert.equal((await rpc('activities_detail',[approval])).members.find(x=>x.user_id===B).status,'pending');
  await rpc('activities_participate',[approval,'accept',B]);assert.equal((await rpc('activities_detail',[approval])).participants_count,2);
  await db.exec('reset role');await db.query('update activities_private.adult_access set revoked_at=now() where user_id=$1',[B]);
  await as(null,'service_role');assert.equal(await rpc('activities_majority_complete',[B,'b'.repeat(64),true]),false);
  await assert.rejects(rpc('activities_majority_begin',[B,'e'.repeat(64)]),/revoked/);
  await as(B);assert.equal((await rpc('activities_capabilities')).can_participate,false);await assert.rejects(rpc('activities_participate',[id,'join',null]),/Accès adulte/);
  await db.exec('reset role');await db.query("update activities_private.adult_access set verified_until=now()-interval '1 second' where user_id=$1",[A]);
  await as(A);assert.equal((await rpc('activities_capabilities')).adult_access,false);
  await as(null,'anon');await assert.rejects(rpc('activities_majority_complete',[B,'b'.repeat(64),true]),/permission denied/);
 }finally{await db.close();}
});
test('server preparation: disabled default, server auth, provider reread, binding and threshold; no client evidence',async()=>{
 await assert.rejects(majorityVerification().start('token'),/indisponible/);
 let session,result,calls=[];const service=majorityVerification({enabled:true,allowedHostedOrigins:['https://verify.example'],auth:{getUser:async token=>token==='valid'?{data:{user:{id:A}}}:{error:true}},provider:{name:'yoti',createSession:async data=>(session=data,{id:'opaque',url:'https://verify.example/start'}),getResult:async()=>result},store:{begin:async(...args)=>calls.push(args),complete:async(...args)=>(calls.push(args),args[2])}});
 await assert.rejects(service.start('invalid'),/indisponible/);const started=await service.start('valid');
 assert.deepEqual(Object.keys(session).sort(),['binding','threshold']);assert.equal(calls[0][0],A);assert.match(calls[0][1],/^[a-f0-9]{64}$/);
 result={sessionId:'opaque',binding:session.binding,threshold:18,status:'pending'};assert.equal((await service.complete('valid',started.receipt)).pending,true);
 result={...result,status:'complete',over18:true,threshold:16};await assert.rejects(service.complete('valid',started.receipt),/indisponible/);
 result.threshold=18;assert.equal((await service.complete('valid',started.receipt)).verified,true);
 result.binding='wrong';await assert.rejects(service.complete('valid',started.receipt),/indisponible/);
});
test('client: V4 account uses existing join/accept RPC; obsolete capabilities remain closed',async()=>{
 const sources=await Promise.all(['js/activities-core.js','js/activities-runtime.js'].map(read));
 for(const cap of [{enabled:true,adult_access:true,version:2,registrations_enabled:false},{enabled:true,adult_access:true,version:4,account_access:true,can_create:true,registrations_enabled:true,can_participate:true}]){
  const d=new JSDOM('<button id="activitiesShortcut">Sorties</button>',{url:'https://preview.invalid',runScripts:'outside-only',pretendToBeVisual:true});const calls=[];let owner=false;
  const activity={id:C,title:'Local',starts_at:'2099-01-01T12:00:00Z',city:'Gap',description:'Local',venue:'Public',capacity:3,remaining:2,participants_count:1,status:'open',join_mode:'direct',visibility:'public',members:[]};
  d.window.scrollTo=()=>{};d.window.confirm=()=>true;d.window.HTMLElement.prototype.scrollIntoView=()=>{};d.window.myeventRuntime={ready:Promise.resolve({environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};d.window.myeventCameraContext=()=>({user:{id:A},sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:name==='activities_capabilities'?cap:name==='activities_list'?[]:name==='activities_detail'?{...activity,is_owner:owner,members:owner?[{user_id:B,status:'pending',display_name:'B'}]:[]}:null};}}});
  try{for(const source of sources)d.window.eval(source);await new Promise(r=>setTimeout(r,0));await d.window.myeventOpenActivity(C);const join=d.window.document.querySelector('[data-act-join]');assert.equal(join?.disabled??true,cap.version!==4);join?.click();await new Promise(r=>setTimeout(r,0));assert.equal(calls.some(x=>x.name==='activities_participate'&&x.args.p_action==='join'),cap.version===4);
   if(cap.version===4){owner=true;await d.window.myeventOpenActivity(C);[...d.window.document.querySelectorAll('button')].find(x=>x.textContent==='Accepter').click();await new Promise(r=>setTimeout(r,0));assert.equal(calls.find(x=>x.args?.p_action==='accept').args.p_user,B);}
  }finally{d.window.close();}
 }
});
