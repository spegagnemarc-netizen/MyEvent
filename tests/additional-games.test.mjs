import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,users,rpc,as} from './games-db.mjs';
import {JSDOM} from 'jsdom';
const init=()=>setup({additional:true});
const snapshot=(db,id,rid)=>rpc(db,id,'activity_snapshot',{target_room:rid});
const act=async(db,id,rid,action,data={})=>{const s=await snapshot(db,id,rid);return rpc(db,id,'activity_action',{target_room:rid,action,data:{revision:s.room.revision,round_no:s.room.round_no,...data}});};
const fixtures={truth:{rounds:2},quiz:{items:[{prompt:'Deux plus deux ?',choices:['1','2','3','4'],answer:'3'},{prompt:'Deux plus un ?',choices:['1','2','3','4'],answer:'2'}]},treasure:{items:[{prompt:'Trouve le code du coffre.',answer:'Orange'},{prompt:'Deuxième indice.',answer:'Noir'}]},blind:{items:[{prompt:'Reconnais cet extrait.',audio_url:'https://example.org/extrait.mp3',choices:['A','B','C','D'],answer:'1'},{prompt:'Deuxième extrait.',audio_url:'https://example.org/deux.mp3',choices:['A','B','C','D'],answer:'0'}]}};
for(const key of Object.keys(fixtures))test(`${key}: genuine PostgreSQL multiplayer lifecycle, privacy and persistence`,async()=>{
 const db=await init();try{
 const rid=await rpc(db,users[0],'activity_create',{options:{game_key:key,players:4,...fixtures[key]}});
 const code=(await snapshot(db,users[0],rid)).room.code;
 await assert.rejects(()=>snapshot(db,users[2],rid),/inaccessible/);
 await assert.rejects(()=>as(db,users[1],'select * from game_private.activities'),/permission denied/);
 await assert.rejects(()=>as(db,null,'select public.activity_snapshot($1)',[rid],'anon'),/permission denied/);
 await assert.rejects(()=>act(db,users[0],rid,'invite',{target:users[1]}),/non autorisée/);
 // Existing social friendship enables the invitation; no permission bypass.
 const invite=await rpc(db,users[0],'create_friend_invite',{});
 await rpc(db,users[1],'accept_friend_invite',{invitation:invite});
 await act(db,users[0],rid,'invite',{target:users[1]});
 assert.equal((await rpc(db,users[1],'activity_my_rooms')).find(r=>r.code===code).invited,true);
 await rpc(db,users[1],'activity_join',{invitation_code:code});
 await assert.rejects(()=>act(db,users[0],rid,'start'),/prêts/);
 for(const user of users.slice(0,2))await act(db,user,rid,'ready',{ready:true});
 await assert.rejects(()=>act(db,users[1],rid,'start'),/hôte/);
 await act(db,users[0],rid,'start');
 await assert.rejects(()=>rpc(db,users[0],'game_action',{target_room:rid,action:'heartbeat'}),/incorrect/);
 await assert.rejects(()=>rpc(db,users[0],'defis_action',{target_room:rid,action:'heartbeat'}),/inaccessible|Salon|moteur|Défis|défis/i);
 for(let round=1;round<=2;round++){
  let s=await snapshot(db,users[0],rid);assert.equal(s.room.round_no,round);
  assert.equal(s.question.answer,undefined);assert.equal(s.room.settings.items,undefined);
  if(key==='truth'){
   const actor=s.question.actor,other=actor===users[0]?users[1]:users[0];
   await assert.rejects(()=>act(db,other,rid,'choose',{kind:'truth'}),/votre tour/);
   await act(db,actor,rid,'choose',{kind:round===1?'truth':'dare'});
   assert.ok((await snapshot(db,actor,rid)).question.prompt);
   await act(db,actor,rid,round===1?'done':'pass');
  }else if(key==='treasure'){
   await act(db,users[1],rid,'answer',{answer:'incorrect'});
   assert.equal((await snapshot(db,users[0],rid)).phase,'active');
   await act(db,users[1],rid,'answer',{answer:fixtures[key].items[round-1].answer.toLowerCase()});
  }else{
   await assert.rejects(()=>act(db,users[0],rid,'answer',{answer:'0',round_no:round-1}),/manche a changé/);
   await act(db,users[0],rid,'answer',{answer:fixtures[key].items[round-1].answer});
   await assert.rejects(()=>act(db,users[0],rid,'answer',{answer:'0'}),/déjà envoyée/);
   assert.equal((await snapshot(db,users[1],rid)).scores.reduce((n,x)=>n+Number(x.points),0),round===1?0:(key==='quiz'?2:1));
   await assert.rejects(()=>act(db,users[0],rid,'reveal'),/Attendez/);
   await act(db,users[1],rid,'answer',{answer:'3'});
   await act(db,users[0],rid,'reveal');
   assert.equal((await snapshot(db,users[1],rid)).question.answer,fixtures[key].items[round-1].answer);
  }
  await assert.rejects(()=>act(db,users[1],rid,'next'),/indisponible/);
  await act(db,users[0],rid,'next');
 }
 const end=await snapshot(db,users[1],rid);assert.equal(end.room.status,'finished');assert.ok(end.scores.length);
 await act(db,users[0],rid,'replay');
 assert.equal((await snapshot(db,users[1],rid)).room.status,'waiting');
 assert.equal((await snapshot(db,users[1],rid)).scores.length,0);
 await act(db,users[0],rid,'leave');assert.equal((await snapshot(db,users[1],rid)).room.host_id,users[1]);
 }finally{await db.close();}
});

test('additional game configuration, private answers, expiration and event membership enforced server-side',async()=>{
 const db=await init();try{
 for(const options of [{game_key:'karaoke'},{game_key:'blind',items:[{prompt:'Q',choices:['A','B','C','D'],answer:'0',audio_url:'http://unsafe/audio'}]},{game_key:'treasure',items:[{prompt:'Indice'}]}])await assert.rejects(()=>rpc(db,users[0],'activity_create',{options}));
 const event='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';await db.query('insert into public.events values($1,$2)',[event,users[0]]);
 await db.query('insert into public.event_members values($1,$2)',[event,users[0]]);
 const rid=await rpc(db,users[0],'activity_create',{options:{game_key:'quiz'},target_event:event});
 await assert.rejects(()=>rpc(db,users[1],'activity_join',{invitation_code:(undefined)}));
 const code=(await snapshot(db,users[0],rid)).room.code;
 await assert.rejects(()=>rpc(db,users[1],'activity_join',{invitation_code:code}),/événement|Événement|participant/i);
 await db.query("update public.game_rooms set expires_at=now()-interval '1 hour' where id=$1",[rid]);
 await assert.rejects(()=>snapshot(db,users[0],rid),/expiré/);
 }finally{await db.close();}
});

test('four real game forms open, custom steps editable, karaoke remains upcoming',async()=>{
 const dom=new JSDOM('<div id="entertainmentLounge"></div>',{url:'https://preview.example/index.html',runScripts:'outside-only'});
 const w=dom.window;let options;
 w.myeventGameContext=()=>({user:{id:users[0]},sb:{}});
 w.MyEventGameSession=class extends w.EventTarget{disconnect(){}async create(value){options=value;throw Error('Test adapter: no remote database');}};
 w.eval(await readFile(new URL('../js/additional-games.js',import.meta.url),'utf8'));
 const root=w.document.querySelector('#entertainmentLounge');
 try{
 for(const key of Object.keys(fixtures)){
  w.OrevamiExtraGames.open(key,root,w.myeventGameContext,()=>{});
  assert.ok(root.querySelector('#extra-create'));
  if(['blind','treasure'].includes(key)){
   root.querySelector('[data-extra-action="add-item"]').click();assert.equal(root.querySelectorAll('.extra-item').length,2);
   root.querySelector('[data-extra-action="remove-item"]').click();assert.equal(root.querySelectorAll('.extra-item').length,1);
  }
 }
 w.OrevamiExtraGames.open('quiz',root,w.myeventGameContext,()=>{});
 root.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,5));assert.equal(options.game_key,'quiz');
 const lounge=await readFile(new URL('../js/entertainment-lounge.js',import.meta.url),'utf8');
 assert.ok(lounge.includes("id==='karaoke'?'disabled':''"));
 assert.ok(lounge.includes("OrevamiExtraGames.resume(rid,key"));
 }finally{w.OrevamiExtraGames.stop();dom.window.close();}
});

test('real GameSession → authenticated PostgreSQL RPC → two rendered Quiz clients finish a game',async()=>{
 const db=await init(),windows=[];
 const client=async(user)=>{
  const dom=new JSDOM('<button id="socialHeaderGamesBtn">Jeux</button><div id="entertainmentLounge"></div>',{url:'https://preview.example/index.html',runScripts:'outside-only'});windows.push(dom);
  const w=dom.window;
  const sb={rpc:async(name,args)=>{try{return {data:await rpc(db,user,name,args||{}),error:null};}catch(error){return {data:null,error};}},channel:()=>({on(){return this;},subscribe(fn){fn('SUBSCRIBED');return this;}}),removeChannel(){}};
  w.myeventGameContext=()=>({user:{id:user},sb});
  for(const file of ['game-session.js','additional-games.js','entertainment-lounge.js'])w.eval(await readFile(new URL('../js/'+file,import.meta.url),'utf8'));
  w.myeventEntertainment.open();return w;
 };
 const wait=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('UI state did not settle');};
 const click=(w,selector)=>{const el=w.document.querySelector(selector);assert.ok(el,selector);el.click();};
 try{
  const a=await client(users[0]),b=await client(users[1]);
  click(a,'[data-game="quiz"]');
  a.document.querySelector('#extra-create').dispatchEvent(new a.Event('submit',{bubbles:true,cancelable:true}));
  await wait(()=>a.document.querySelector('.gl-room-code'));
  const code=a.document.querySelector('.gl-room-code').textContent;
  b.document.querySelector('#gl-code').value=code;
  b.document.querySelector('#gl-join').dispatchEvent(new b.Event('submit',{bubbles:true,cancelable:true}));
  await wait(()=>b.document.querySelector('[data-extra-action="ready"]'));
  click(a,'[data-extra-action="ready"]');await wait(()=>a.document.body.textContent.includes('Je ne suis plus prêt'));
  click(b,'[data-extra-action="ready"]');await wait(()=>b.document.body.textContent.includes('Je ne suis plus prêt'));
  click(a,'[data-extra-action="refresh"]');await wait(()=>a.document.querySelector('[data-extra-action="start"]')?.disabled===false);
  click(a,'[data-extra-action="start"]');await wait(()=>a.document.querySelector('#extra-answer'));
  for(let round=1;round<=5;round++){
   if(round===1){click(b,'[data-extra-action="refresh"]');await wait(()=>b.document.querySelector('#extra-answer'));}
   for(const w of [a,b]){
    w.document.querySelector('#extra-answer input[value="0"]').checked=true;
    w.document.querySelector('#extra-answer').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await wait(()=>w.document.body.textContent.includes('Réponse enregistrée'));
   }
   click(a,'[data-extra-action="refresh"]');await wait(()=>!a.document.querySelector('#entertainmentLounge').hasAttribute('aria-busy'));
   click(a,'[data-extra-action="reveal"]');await wait(()=>a.document.body.textContent.includes('Bonne réponse'));
   click(a,'[data-extra-action="next"]');
   if(round<5){await wait(()=>a.document.querySelector('#extra-answer'));click(b,'[data-extra-action="refresh"]');await wait(()=>b.document.querySelector('#extra-answer'));}
   else await wait(()=>a.document.body.textContent.includes('Partie terminée'));
  }
  click(b,'[data-extra-action="refresh"]');await wait(()=>b.document.body.textContent.includes('Partie terminée'));
  assert.ok(a.document.body.textContent.includes('Classement'));assert.ok(b.document.body.textContent.includes('Classement'));
 }finally{for(const dom of windows){dom.window.OrevamiExtraGames?.stop();dom.window.close();}await db.close();}
});

test('event games reject pending/inactive members using the actual TEST membership schema',async()=>{
 const db=await init();try{
 await db.exec("alter table public.event_members add column status text default 'confirmed'");
 await db.exec(await readFile(new URL('../supabase/migrations/202610130002_games_event_membership_test.sql',import.meta.url),'utf8'));
 const event='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await db.query('insert into public.events values($1,$2)',[event,users[0]]);
 await db.query("insert into public.event_members(event_id,user_id,status) values($1,$2,'pending'),($1,$3,'inactive'),($1,$4,'active')",[event,users[1],users[2],users[3]]);
 const rid=await rpc(db,users[0],'activity_create',{options:{game_key:'quiz'},target_event:event});
 const code=(await snapshot(db,users[0],rid)).room.code;
 for(const user of [users[1],users[2]]){
  await assert.rejects(()=>rpc(db,user,'activity_create',{options:{game_key:'quiz'},target_event:event}),/inaccessible/);
  await assert.rejects(()=>rpc(db,user,'activity_join',{invitation_code:code}),/participants/);
  await assert.rejects(()=>act(db,users[0],rid,'invite',{target:user}),/non autorisée/);
 }
 await act(db,users[0],rid,'invite',{target:users[3]});
 await rpc(db,users[3],'activity_join',{invitation_code:code});
 assert.equal((await snapshot(db,users[3],rid)).players.length,2);
 await db.query("update public.event_members set status='inactive' where event_id=$1 and user_id=$2",[event,users[3]]);
 await assert.rejects(()=>snapshot(db,users[3],rid),/inaccessible/);
 }finally{await db.close();}
});
