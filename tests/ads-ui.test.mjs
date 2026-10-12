import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
async function fixture({campaigns=[],adminDenied=false}={}){
 const dom=new JSDOM(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://myevent.test/',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.setInterval=()=>0;w.AbortSignal=globalThis.AbortSignal;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.sb={auth:{getSession:async()=>({data:{session:{access_token:'local-test',user:{id:'local-owner'}}}}),onAuthStateChange(){}}};
 w.myeventRuntime={ready:Promise.resolve({environment:'preview',isTest:true,projectRef:'ahyyknfjsielnqyoxqgh'})};
 const plans=[['welcome','Bienvenue',0,15],['discovery','Découverte',199,7],['visibility','Visibilité',499,15],['premium','Premium',999,30],['professional','Professionnel',1999,30]].map(([key,name,price_cents,duration_days])=>({key,name,price_cents,duration_days,max_visuals:1,geography:key==='professional'?'national':'department',max_campaigns:key==='professional'?3:key==='premium'?1:null}));
 w.fetch=async(_url,options)=>{const body=JSON.parse(options.body),action=body.action;calls.push(body);const data={ads_catalog:{plans,settings:{spacing:6,enabled:false,payments_enabled:false},welcome_used:false},ads_mine:campaigns,ads_history:[],ads_feed:[],ads_audit:[],ads_admin_list:{campaigns,revenue_cents:0,external:[],payments:[]}}[action]||{ok:true};return {ok:!(adminDenied&&action==='ads_admin_list'),json:async()=>adminDenied&&action==='ads_admin_list'?{error:'Accès administrateur refusé'}:data};};
 w.eval(read('js/ads-runtime.js'));await new Promise(resolve=>setImmediate(resolve));return {dom,w,calls};
}
async function settled(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
test('five approved launch offers render from the database, with no card/payment for Welcome',async()=>{
 const {dom,w}=await fixture({campaigns:[{id:'welcome',plan_key:'welcome',business:'Entreprise locale TEST',title:'Bienvenue TEST',body:'Offre gratuite',status:'approved',price_cents:0,free_activated_at:'2026-01-01',starts_at:'2026-01-01',ends_at:'2099-01-01',paid_at:null,impressions:0,clicks:0}]});
 w.document.getElementById('myEventAdsEntry').click();await settled();assert.equal(w.document.querySelectorAll('#myEventAdsPlans .adPlan').length,5);assert.match(w.document.getElementById('myEventAdsPlans').textContent,/Gratuit/);assert(!w.document.getElementById('myEventAdsCampaigns').textContent.includes('Payer avec Stripe'));assert.match(w.document.getElementById('myEventAdsCampaigns').textContent,/aucun paiement ni carte bancaire/);w.close();
});
test('submission without required image is blocked before creating a campaign',async()=>{
 const {w,calls}=await fixture();w.document.getElementById('myEventAdsEntry').click();await settled();const form=w.document.getElementById('myEventAdsForm');form.elements.professional.checked=true;form.elements.target_url.value='https://example.com/offre';form.elements.zone.value='75';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settled();assert.match(w.document.getElementById('myEventAdsMessage').textContent,/visuel/);assert(!calls.some(c=>c.action==='ads_create'));w.close();
});
test('server administrator denial is displayed and no management forms are exposed',async()=>{
 const {w}=await fixture({adminDenied:true});await w.myeventAds.loadAdmin();assert.match(w.document.getElementById('myEventAdminAds').textContent,/refusé/);assert.equal(w.document.querySelectorAll('#myEventAdminAds form').length,0);w.close();
});
test('administrator prices and durations are editable while Welcome price stays free',async()=>{
 const {w}=await fixture();await w.myeventAds.loadAdmin();const forms=[...w.document.querySelectorAll('#myEventAdminAds form.adPlan')];assert.equal(forms.length,5);assert.equal(forms[0].elements.price.value,'0');assert.equal(forms[0].elements.price.readOnly,true);assert.equal(forms[1].elements.price.value,'1.99');assert.equal(forms[1].elements.duration.value,'7');assert.equal(forms[1].elements.price.readOnly,false);w.close();
});

test('Premium and Professional have distinct rules and national form targeting',async()=>{const {w}=await fixture();w.document.getElementById('myEventAdsEntry').click();await settled();const cards=[...w.document.querySelectorAll('#myEventAdsPlans .adPlan')];assert.match(cards[3].textContent,/1 publicité simultanée/);assert.match(cards[4].textContent,/3 publicités simultanées/);assert.match(cards[4].textContent,/prioritaire/);const plan=w.document.getElementById('myEventAdsPlan'),zone=w.document.getElementById('myEventAdsForm').elements.zone;plan.value='professional';plan.dispatchEvent(new w.Event('change'));assert.equal(zone.value,'national');assert.equal(zone.readOnly,true);plan.value='premium';plan.dispatchEvent(new w.Event('change'));assert.equal(zone.readOnly,false);assert.equal(zone.value,'');w.close();});
