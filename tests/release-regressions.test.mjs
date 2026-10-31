import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url);
const source=p=>readFile(new URL(p,root),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

test('late login hydrates camera posts; stale account results, duplicates and failures stay isolated',async()=>{
 const dom=new JSDOM('<div id="socialFeed"></div><p id="socialFeedEmpty"></p>',{runScripts:'outside-only'}),w=dom.window;
 let user=null,resolveOld,calls=0,fail=false,delayed=false;
 w.eval(await source('js/camera-feed-refresh.js'));
 const loader=w.createCameraFeedRefresh({context:()=>({user}),load:async()=>{calls++;if(fail)throw Error('offline');if(delayed)return new Promise(resolve=>resolveOld=resolve);return [{id:'photo'}];},render:item=>{const node=w.document.createElement('article');node.dataset.cameraPostId=item.id;w.document.getElementById('socialFeed').append(node);}});
 try{
  assert.equal(calls,0);user={id:'A'};
  await new Promise(resolve=>setTimeout(resolve,1050));assert.equal(calls,1);assert.equal(w.document.querySelectorAll('article').length,1);
  await loader.refresh();assert.equal(w.document.querySelectorAll('article').length,1);
  delayed=true;const old=loader.refresh();user={id:'B'};delayed=false;await loader.refresh();resolveOld([{id:'private-A'}]);await old;
  assert.equal(w.document.querySelector('[data-camera-post-id="private-A"]'),null);
  fail=true;await loader.refresh();assert.equal(w.document.getElementById('cameraFeedStatus').dataset.state,'error');assert.equal(w.document.getElementById('socialFeedEmpty').hidden,true);
  user=null;await loader.refresh();assert.equal(w.document.querySelectorAll('article').length,0);
 }finally{loader.stop();w.close();}
});

test('six developed games remain enabled and route to their actual forms',async()=>{
 const dom=new JSDOM('<button id="socialHeaderGamesBtn"></button><div id="entertainmentLounge"></div>',{url:'https://test.example/',runScripts:'outside-only'}),w=dom.window;
 w.myeventGameContext=()=>({user:{id:'test'},sb:{rpc:async()=>({data:[],error:null})}});
 try{
  for(const p of ['js/game-session.js','js/additional-games.js','js/entertainment-lounge.js'])w.eval(await source(p));
  for(const game of ['infiltre','defis','truth','treasure','quiz','blind']){
   w.myeventEntertainment.open();const button=w.document.querySelector('[data-game="'+game+'"]');assert.ok(button);assert.equal(button.disabled,false);assert.match(button.textContent,/Jouer/);button.click();assert.ok(w.document.querySelector('form'));w.myeventEntertainment.close();w.OrevamiExtraGames.stop();
  }
  w.myeventEntertainment.open();assert.equal(w.document.querySelector('[data-game="karaoke"]').disabled,true);
 }finally{w.close();}
});

test('the original bound logout button lives inside visible profile on desktop and mobile',async()=>{
 for(const width of [390,1440]){
  const dom=new JSDOM('<div id="main"><div class="card socialProfileStatusCard"><button id="logoutBtn">Déconnexion</button></div><div class="card" id="profileSettingsCard"></div></div>',{url:'https://test.example/',runScripts:'outside-only'}),w=dom.window;
  try{
   w.innerWidth=width;const original=w.document.getElementById('logoutBtn');let clicks=0;original.onclick=()=>clicks++;
   w.eval(await source('js/section-navigation.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
   assert.equal(w.document.getElementById('logoutBtn'),original);assert.equal(original.closest('#profileSettingsCard')?.id,'profileSettingsCard');original.click();assert.equal(clicks,1);
   const style=w.document.createElement('style');style.textContent=await source('css/section-navigation.css');w.document.head.append(style);w.document.body.classList.add('profileSectionOpen');assert.notEqual(w.getComputedStyle(original).display,'none');assert.equal(w.getComputedStyle(original).minHeight,'44px');
  }finally{w.close();}
 }
});

test('Production baseline modules stay byte-identical unless explicitly reviewed',async()=>{
 const manifest=JSON.parse(await source('docs/release-preservation.json'));
 for(const [path,expected] of Object.entries(manifest.files)){
  let bytes=await readFile(new URL(path,root));
  if(!bytes.includes(0))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,'Unreviewed change/removal: '+path);
 }
 const html=await source('index.html');for(const src of manifest.scripts)assert.ok(html.includes(src),'Missing Production script: '+src);
 assert.ok(html.indexOf('js/additional-games.js')<html.indexOf('js/entertainment-lounge.js'));
 assert.ok(html.indexOf('js/camera-feed-refresh.js')<html.indexOf('js/home-social-runtime.js'));
});
