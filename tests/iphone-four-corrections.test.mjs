import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('reserved sponsored space follows the fifth post without campaigns, requests or replacing posts',async()=>{
 const w=new JSDOM('<section><div id="socialFeed"></div></section>',{runScripts:'outside-only'}).window;
 try{
  let calls=0,clicks=0;w.fetch=()=>{calls++;throw Error('No network allowed');};
  const feed=w.document.getElementById('socialFeed');w.eval(read('js/ads-placement.js'));
  const slot=w.document.getElementById('orevamiSponsoredPlacement');assert.equal(feed.nextElementSibling,slot);
  assert.match(slot.textContent,/aucune campagne/);assert.equal(slot.querySelectorAll('a,img,iframe,script').length,0);
  const posts=Array.from({length:6},()=>{const p=w.document.createElement('article');p.className='socialPost';p.onclick=()=>clicks++;feed.append(p);return p;});
  await flush();assert.equal(posts[4].nextElementSibling,slot);posts[2].click();assert.equal(clicks,1);
  posts[0].remove();await flush();assert.equal(posts[5].nextElementSibling,slot);
  posts[1].remove();await flush();assert.equal(feed.nextElementSibling,slot);
  assert.equal(w.document.querySelectorAll('#orevamiSponsoredPlacement').length,1);assert.equal(calls,0);
  assert(read('index.html').includes('myEventAdsPanel'));assert(read('js/ads-runtime.js').includes("c.environment==='preview'"));
 }finally{w.close();}
});

test('event actions retain existing handlers, delete confirmation and action distinctions',async()=>{
 const w=new JSDOM(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://orevami.test/',runScripts:'outside-only'}).window;
 try{
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.CSS={escape:s=>s};
  const event={id:'synthetic',name:'Événement synthétique',creator_id:'owner'};
  const ctx={user:{id:'owner'},event,role:'owner',events:[event]};
  let edits=0,invites=0,confirms=0,deletions=0;
  w.confirm=()=>{confirms++;return false;};
  w.document.getElementById('eventList').innerHTML='<div class="eventCard" data-event-id="synthetic"><div class="eventCardMenu"><button class="editEventListBtn">Modifier</button><button class="inviteEventListBtn">Inviter</button><button class="deleteEventBtn">Supprimer</button></div></div>';
  w.document.querySelector('.editEventListBtn').onclick=()=>edits++;
  w.document.querySelector('.inviteEventListBtn').onclick=()=>invites++;
  w.document.querySelector('.deleteEventBtn').onclick=()=>{if(w.confirm('Supprimer ?'))deletions++;};
  w.myeventEventsBridge={context:()=>ctx,load:async()=>ctx.events,cover:async()=>'',select:async()=>{},form:()=>{},tab:()=>{},closeDiscussion:()=>{}};
  w.eval(read('js/events-workspace.js'));await w.myeventEventsWorkspace.open();
  w.document.querySelector('[data-event-menu]').click();
  const buttons=[...w.document.querySelectorAll('.ewEventActions button')];
  assert.deepEqual(buttons.map(b=>b.dataset.eventAction),['edit','invite','delete']);buttons.forEach(b=>b.click());
  assert.deepEqual([edits,invites,confirms,deletions],[1,1,1,0]);
  const css=read('css/events-workspace.css');assert.match(css,/max-width:350px/);assert.match(css,/focus-visible/);assert.match(css,/min-height:58px/);
 }finally{w.close();}
});

test('all four signature selections use the shared ORÉVAMI renderer and export at the edited position',()=>{
 const w=new JSDOM('<section id="modal" aria-hidden="false"><div class="cameraProPreview"><img id="myeventCapturedImage"></div><div id="cameraCreativePanel" hidden></div><div id="cameraPanelContent"></div><div id="cameraPanelTitle"></div></section>',{runScripts:'outside-only'}).window;
 try{
  const calls=[],contexts=new Map();
  w.Path2D=class{constructor(path){this.path=path;}};
  w.HTMLCanvasElement.prototype.getContext=function(){if(!contexts.has(this))contexts.set(this,new Proxy({measureText:()=>({width:170})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push({canvas:this,key:k,args})}));return contexts.get(this);};
  w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:600,height:400});
  const modal=w.document.getElementById('modal'),photo=w.document.getElementById('myeventCapturedImage');
  Object.defineProperties(photo,{naturalWidth:{value:1200},naturalHeight:{value:800}});
  modal.cameraHasPhoto=()=>true;modal.cameraGetPhotoSource=()=>({width:1200,height:800});modal.cameraResumeEdit=()=>{};
  w.eval(read('js/camera-annotations.js'));const api=w.createCameraAnnotations(modal),host=w.document.getElementById('cameraPanelContent');api.signatures(host);
  assert.deepEqual([...host.querySelectorAll('[data-signature]')].map(b=>b.dataset.signature),['classic','heart','crown','handwritten']);
  for(const style of ['classic','heart','crown','handwritten']){
   host.querySelector('[data-signature="'+style+'"]').click();assert.equal(host.querySelector('[data-signature="'+style+'"]').getAttribute('aria-pressed'),'true');
   const output=w.document.createElement('canvas');output.width=1200;output.height=800;calls.length=0;api.render(output);
   const rendered=calls.filter(c=>c.canvas===output);
   assert(rendered.some(c=>c.key==='translate'&&c.args[0]===600&&c.args[1]===256));
   if(style==='handwritten')assert(rendered.some(c=>c.key==='stroke'&&c.args[0]?.path?.includes('M 73 -5 L 83 -12')));
   else assert(rendered.some(c=>c.key==='fillText'&&c.args[0]==='ORÉVAMI'));
  }
  const layer=modal.querySelector('.cameraDecorationLayer');layer.setPointerCapture=()=>{};layer.hasPointerCapture=()=>false;
  const pointer=(type,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,clientX:x,clientY:y});layer.dispatchEvent(e);};
  pointer('pointerdown',300,128);pointer('pointermove',360,158);pointer('pointerup',360,158);
  const output=w.document.createElement('canvas');output.width=1200;output.height=800;calls.length=0;api.render(output);
  assert(calls.some(c=>c.canvas===output&&c.key==='translate'&&c.args[0]===720&&c.args[1]===316));
 }finally{w.close();}
});
