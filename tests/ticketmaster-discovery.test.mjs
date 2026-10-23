import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fresh=()=>{delete require.cache[require.resolve('../server/search-ticketmaster')];return require('../server/search-ticketmaster');};
async function request(handler,query={},method='GET'){
 const result={status:200,headers:{}};
 await handler({method,query},{setHeader(k,v){result.headers[k]=v;},status(n){result.status=n;return this;},json(body){result.body=body;}});
 return result;
}
test('Discovery validates input, protects credentials, caches searches and hides upstream errors',async()=>{
 const oldKey=process.env.TICKETMASTER_API_KEY,oldFetch=globalThis.fetch;let calls=0;
 try{
  delete process.env.TICKETMASTER_API_KEY;let handler=fresh();
  assert.equal((await request(handler)).status,503);
  assert.equal((await request(handler,{},'POST')).status,405);
  for(const query of [{q:['x']},{city:'x'.repeat(101)}])assert.equal((await request(handler,query)).status,400);
  process.env.TICKETMASTER_API_KEY='fixture-private-key';
  globalThis.fetch=async(value,options)=>{
   calls++;const url=new URL(value);assert.equal(url.origin,'https://app.ticketmaster.com');
   assert.equal(url.searchParams.get('countryCode'),'FR');assert.equal(url.searchParams.get('apikey'),'fixture-private-key');
   assert.equal(url.searchParams.get('city'),'Paris');assert.equal(url.searchParams.get('size'),'20');assert(options.signal);
   return {ok:true,json:async()=>({_links:{self:{href:value}},_embedded:{events:[
    {id:'1',name:'Concert',url:'https://www.ticketmaster.fr/event/1?apikey=fixture-private-key',dates:{start:{localDate:'2099-01-02'}},_embedded:{venues:[{name:'Salle',city:{name:'Paris'}}]}},
    {name:'unsafe',url:'javascript:alert(1)'},{name:'other',url:'https://ticketmaster.fr.evil.example/'},
   ]}})};
  };
  const [a,b]=await Promise.all([request(handler,{city:'Paris'}),request(handler,{city:'Paris'})]);
  assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.body.results.length,1);
  assert.equal(a.body.results[0].url,'https://www.ticketmaster.fr/event/1');
  assert(!JSON.stringify(a).includes('fixture-private-key'));assert.match(a.headers['Cache-Control'],/s-maxage=300/);
  globalThis.fetch=async()=>{throw Error('https://provider/?apikey=fixture-private-key');};handler=fresh();
  const failure=await request(handler);assert.equal(failure.status,502);assert(!JSON.stringify(failure).includes('fixture-private-key'));
  globalThis.fetch=async()=>({ok:false,status:401,json:async()=>{throw Error('Must not expose body');}});
  assert.equal((await request(fresh())).status,502);
  globalThis.fetch=async()=>({ok:true,json:async()=>({})});handler=fresh();
  for(let n=0;n<4;n++)assert.equal((await request(handler,{q:String(n)})).status,200);
  assert.equal((await request(handler,{q:'fifth'})).status,429);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.TICKETMASTER_API_KEY;else process.env.TICKETMASTER_API_KEY=oldKey;}
});
test('both ticket surfaces preserve the exact existing widget and render untrusted event names as text',async()=>{
 const baseline=execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'});
 const original=new JSDOM(baseline).window.document.querySelector('.tnSearchWidget').outerHTML;
 for(const page of ['index.html','explorer-partners-ticket.html']){
  const dom=new JSDOM(read(page),{url:'https://orevami.com/',runScripts:'outside-only'}),w=dom.window;
  try{
   assert.equal(w.document.querySelector('.tnSearchWidget').outerHTML,original);
   w.AbortSignal=AbortSignal;let calls=0;
   w.fetch=async url=>{calls++;assert.match(url,/^\/api\/search-ticketmaster\?/);return {ok:true,json:async()=>({results:[{name:'<img src=x onerror=alert(1)>',date:'2099-01-02',city:'Paris',url:'https://www.ticketmaster.fr/event/1'}]})};};
   w.eval(read('js/ticketmaster-discovery.js'));assert.equal(calls,0);
   const form=w.document.querySelector('#ticketmasterDiscovery form');form.dispatchEvent(new w.Event('submit',{cancelable:true}));
   await new Promise(resolve=>setTimeout(resolve,0));
   assert.equal(calls,1);const results=w.document.querySelector('[data-results]');assert.equal(results.querySelector('img'),null);
   assert.match(results.textContent,/<img src=x/);assert.match(results.textContent,/02\/01\/2099/);assert.equal(form.querySelector('button').disabled,false);
   w.fetch=async()=>({ok:false,json:async()=>({error:'Indisponible'})});form.dispatchEvent(new w.Event('submit',{cancelable:true}));
   await new Promise(resolve=>setTimeout(resolve,0));assert.equal(results.children.length,0);assert.equal(w.document.querySelector('#ticketmasterDiscovery [role=status]').textContent,'Indisponible');
  }finally{dom.window.close();}
 }
});
test('Discovery uses the existing function and server source cannot be served',()=>{
 const routes=JSON.parse(read('vercel.json')).routes;assert(routes.some(r=>r.status===404&&new RegExp(r.src).test('/server/search-ticketmaster.js')));
 const router=require('../api/[search].js');
 return request((req,res)=>router({...req,url:'/api/search-ticketmaster'},res),{},'POST').then(result=>assert.equal(result.status,405));
});
