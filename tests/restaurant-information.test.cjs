const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const {analyseRestaurant}=require('../lib/venue-analysis');
const {createRestaurantInformation}=require('../lib/restaurant-information');
const card=require('../js/place-card');
const date='2026-10-24T12:00:00.000Z';
const home='<nav><a href="/carte">Notre carte</a><a href="/contact">Contact et réservation</a></nav><main><h1>Restaurant de démonstration</h1></main>';
const menu='<main><h1>Carte de saison</h1><h2>Plats</h2><p>Poisson du marché : 27 €</p><a href="/menu.pdf">Menu PDF</a></main>';
const contact='<main><h1>Contact</h1><p><strong>Horaires d’ouverture</strong></p><p>Mardi au samedi 12 h–13 h 15</p><p>Informations pratiques</p><a href="https://booking.example.org/request">Demander une réservation</a></main>';

test('generic reader follows menu/contact navigation, keeps per-page sources and extracts no availability',async()=>{
  const reads=[];
  const result=await analyseRestaurant('https://restaurant.example.org/',{now:()=>new Date(date),reader:async(url,{kind})=>{
    reads.push(url);return {url,body:Buffer.from(kind==='robots'?'':url.endsWith('/carte')?menu:url.endsWith('/contact')?contact:home)};
  }});
  assert.equal(reads.length,4); // robots, homepage, two bounded relevant pages
  assert.match(result.opening_hours[0].text,/Mardi/);
  assert.ok(result.prices.some(p=>p.text.includes('27 €')&&p.source_url.endsWith('/carte')));
  assert.ok(result.menu_links.some(m=>m.url.endsWith('/menu.pdf')));
  assert.ok(result.booking_links.some(b=>b.url==='https://booking.example.org/request'&&b.verified===false));
  assert.equal(result.sources.length,3);
  assert.ok(result.sources.every(s=>s.checked_at===date));
  assert.equal(result.availability.status,'not_provided');
});

test('cache deduplicates concurrent requests, expires, caches failures briefly and ignores alleged inventory',async()=>{
  let time=0,calls=0,release;
  const wait=new Promise(r=>release=r);
  const info=createRestaurantInformation({now:()=>time,ttl:100,failureTtl:10,analyse:async url=>{calls++;await wait;if(url.includes('broken'))throw Error();return {website:url,opening_hours:[{text:'12–14 h',source_url:url}],menu_links:[],prices:[],sources:[{url,checked_at:date}],checked_at:date,availability:{status:'available',slots:['invented']}};}});
  const first=info('https://restaurant.example.org/'),second=info('https://restaurant.example.org/');release();
  assert.deepEqual(await first,await second);assert.equal(calls,1);
  const hit=await info('https://restaurant.example.org/');assert.equal(hit.checked_at,date);
  assert.equal(hit.availability.status,'not_provided');assert.equal(hit.availability.slots,undefined);
  time=101;await info('https://restaurant.example.org/');assert.equal(calls,2);
  const failed=await info('https://broken.example.org/');assert.equal(failed.checked_at,null);assert.equal(failed.sources.length,0);
  await info('https://broken.example.org/');assert.equal(calls,3);
  time=112;await info('https://broken.example.org/');assert.equal(calls,4);
  for(const url of ['https://127.0.0.1/','http://restaurant.example.org/','https://facebook.com/restaurant'])await assert.rejects(info(url));
  assert.equal(calls,4);
});

test('two restaurants in different cities use the existing sheet; missing facts are explicit and stale responses cannot replace another card',async()=>{
 const d=new JSDOM('<main></main>',{url:'https://preview.invalid/',runScripts:'outside-only'});
 try{
  const w=d.window,doc=w.document;for(const script of ['activities-core','restaurant-information','activity-venue-sheet'])w.eval(fs.readFileSync(path.join(__dirname,'../js',script+'.js'),'utf8'));
  let slow;
  w.fetch=async(url,options)=>{const site=JSON.parse(options.body).url;if(site.includes('slow'))await new Promise(r=>slow=r);return {ok:true,json:async()=>({status:'available',opening_hours:[{heading:'Horaires',text:'12–14 h'}],prices:[{text:'Plat : 27 €'}],menus:[{label:'Carte',url:site+'menu'}],booking_links:[],sources:[{type:'html',url:site,checked_at:date}],checked_at:date,notice:'Informations à reconfirmer'})};};
  const sheet=w.OrevamiVenueSheet.create({host:doc.querySelector('main'),readOnly:true});
  await sheet.open({id:'geoapify-lyon',name:'Restaurant Lyon',city:'Lyon',category:'restaurant',website:'https://lyon.example.org/'});
  assert.match(sheet.element.textContent,/Plat : 27 €/);assert.match(sheet.element.textContent,/24\/10\/2026/);
  assert.ok(sheet.element.querySelector('a[href="https://lyon.example.org/menu"]'));
  assert.ok(![...sheet.element.querySelectorAll('a,button')].some(n=>/^(🎟️ )?Réserver$/.test(n.textContent)));
  const pending=sheet.open({id:'geoapify-slow',name:'Restaurant lent',category:'restaurant',website:'https://slow.example.org/'});
  await sheet.open({id:'geoapify-lille',name:'Restaurant Lille',city:'Lille',category:'restaurant'});
  slow();await pending;
  assert.equal(sheet.current.name,'Restaurant Lille');
  assert.match(sheet.element.textContent,/Information non disponible/);
  assert.equal(sheet.current.sources.length,0);
  const wrapper=doc.createElement('div');wrapper.innerHTML=card.content({id:'geoapify-1',name:'Restaurant quelconque',type:'restaurant',website:'https://lyon.example.org/'});
  assert.ok(wrapper.querySelector('[data-restaurant-details]'));
  sheet.destroy();
 }finally{d.window.close();}
});
