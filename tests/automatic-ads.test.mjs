import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
import {createTcfConsentBridge} from '../js/ads-consent.mjs';
import {normalizeSettings,planSlots,automaticReady} from '../js/automatic-ads-policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=normalizeSettings({enabled:true,feed_enabled:true,spacing:8,max_slots:2,publisher_id:'ca-pub-1234567890123456',slot_id:'1234567890',cmp_id:42,approved:true});
test('release defaults, preview and malformed config fail closed',()=>{
 assert.equal(automaticReady(config,'production'),false);assert.equal(automaticReady(config,'preview',true),false);assert.equal(automaticReady(config,'production',true),true);
 assert.equal(automaticReady(normalizeSettings({...config,publisher_id:'bad'}),'production',true),false);
 assert.equal(normalizeSettings({spacing:0,max_slots:99}).spacing,8);
});
test('shared inventory respects direct priority, spacing, cap and short feeds',()=>{
 assert.deepEqual(planSlots(4,config),[]);assert.deepEqual(planSlots(24,config),[8,16]);
 assert.deepEqual(planSlots(24,config,[6]),[16]);assert.deepEqual(planSlots(24,config,[6,12]),[]);
 assert.deepEqual(planSlots(24,{...config,max_slots:0}),[]);
});
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
async function fixture(released=false){
 const dom=new JSDOM('<button id="orevamiAdsPreferences">Choix</button><button id="orevamiWithdrawAdsConsent">Refuser</button><span id="orevamiAdsConsentStatus"></span><div id="socialFeed">'+Array.from({length:24},()=>'<article class="socialPost">Post TEST</article>').join('')+'</div>',{url:'https://orevami.test/#home',runScripts:'outside-only'}),w=dom.window;
 let mounts=0,destroys=0;const observers=[];
 w.setInterval=()=>1;w.clearInterval=()=>{};
 w.sb={from:()=>({select:()=>({eq:()=>({single:async()=>({data:config})})})}),auth:{onAuthStateChange(){}}};
 w.myeventRuntime={ready:Promise.resolve({environment:'production'})};
 w.IntersectionObserver=class{constructor(cb){this.cb=cb;this.targets=[];observers.push(this);}observe(x){this.targets.push(x);}unobserve(){}disconnect(){this.targets=[];}};
 w.normalizeSettings=normalizeSettings;w.planSlots=planSlots;w.automaticReady=(c,e)=>automaticReady(c,e,released);w.AUTOMATIC_ADS_RELEASE_APPROVED=released;
 w.createTcfConsentBridge=options=>createTcfConsentBridge(options,w);
 w.createAdSenseAdapter=()=>({initialize(){return true;},available(){return true;},mount(el){mounts++;const ins=w.document.createElement('ins');ins.dataset.adStatus='filled';el.append(ins);return true;},destroy(){destroys++;}});
 w.eval(read('js/automatic-ads-runtime.mjs').replace(/^import .*;\n/gm,''));await settle();
 return {w,observers,get mounts(){return mounts;},get destroys(){return destroys;}};
}
test('default runtime makes no provider mount, even with complete settings',async()=>{const f=await fixture();assert.equal(f.mounts,0);assert.equal(f.observers.length,0);assert.equal(f.w.document.querySelectorAll('.automaticAd').length,0);f.w.close();});
test('lazy mount, direct collision, no repeated refresh, private route and withdrawal',async()=>{
 const f=await fixture(true),w=f.w;assert.equal(f.mounts,0);const o=f.observers.at(-1);assert.equal(o.targets.length,2);
 const target=o.targets[0];o.cb([{target,isIntersecting:true}]);assert.equal(f.mounts,1);assert.equal(w.document.querySelectorAll('.automaticAd').length,1);
 await w.orevamiAutomaticAds.refresh();assert.equal(f.mounts,1);
 const sponsor=w.document.createElement('article');sponsor.className='adSponsored';w.document.querySelectorAll('.socialPost')[5].after(sponsor);await settle();assert.equal(w.document.querySelectorAll('.automaticAd').length,0);
 w.location.hash='#events/discussion';await settle();assert.equal(w.document.querySelectorAll('.automaticAd').length,0);
 w.dispatchEvent(new w.Event('orevami:ads-consent-withdrawn'));assert(f.destroys>0);w.close();
});
test('schema: only active administrators can update, readers cannot mutate settings',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns text language sql stable as $$select current_setting('test.uid',true)$$;
 create function public.myevent_is_admin() returns boolean language sql stable as $$select auth.uid()='admin'$$;
 create function public.myevent_account_active() returns boolean language sql stable as $$select auth.uid() in ('admin','member')$$;
 grant usage on schema auth to authenticated;`);
 await db.exec(read('supabase/migrations/20261026164922_automatic_ads_v1_test_settings.sql'));
 const as=(uid,fn)=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('test.uid',$1,true)",[uid]);return fn(tx);});
 assert.equal((await as('member',tx=>tx.query('select * from public.automatic_ad_settings'))).rows[0].enabled,false);
 assert.equal((await as('member',tx=>tx.query('update public.automatic_ad_settings set enabled=true returning id'))).rows.length,0);
 assert.equal((await as('admin',tx=>tx.query('update public.automatic_ad_settings set enabled=true returning id'))).rows.length,1);
 assert.equal((await as('suspended',tx=>tx.query('update public.automatic_ad_settings set enabled=false returning id'))).rows.length,0);
 await assert.rejects(()=>as('admin',tx=>tx.query('update public.automatic_ad_settings set spacing=0')));
 await assert.rejects(()=>as('member',tx=>tx.query('insert into public.automatic_ad_settings(id) values(false)')));
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select * from public.automatic_ad_settings');}));
 }finally{await db.close();}
});
test('automatic admin respects server permission and saves suspension through protected table',async()=>{
 for(const authorized of [false,true]){
  const dom=new JSDOM('<button data-admin-tab="settings"></button><section id="orevamiAutomaticAdsAdmin"></section>',{url:'https://orevami.test',runScripts:'outside-only'}),w=dom.window;let payload=null,suspended=0;
  w.setInterval=()=>1;w.normalizeSettings=normalizeSettings;w.AUTOMATIC_ADS_RELEASE_APPROVED=false;w.orevamiAutomaticAds={suspend(){suspended++;},refresh(){}};
  w.sb={rpc:async()=>({data:authorized}),from:()=>({select:()=>({eq:()=>({single:async()=>({data:config})})}),update:data=>{payload=data;return {eq:()=>({select:async()=>({data:[{id:true}]})})};}})};
  w.eval(read('js/automatic-ads-admin.mjs').replace(/^import .*;\n/gm,''));w.document.querySelector('button').click();await settle();
  const form=w.document.querySelector('form');assert.equal(!!form,authorized);
  if(authorized){[...form.querySelectorAll('button')].find(b=>b.textContent==='Suspendre immédiatement').click();await settle();assert.deepEqual(JSON.parse(JSON.stringify(payload)),{enabled:false});assert.equal(suspended,1);}
  w.close();
 }
});
test('local withdrawal persists while administrative suspension does not change consent',async()=>{
 const f=await fixture(),w=f.w;
 w.orevamiAutomaticAds.suspend();assert.equal(w.localStorage.getItem('orevami.autoAdsRefused'),null);
 w.document.getElementById('orevamiWithdrawAdsConsent').click();assert.equal(w.localStorage.getItem('orevami.autoAdsRefused'),'1');
 assert(w.document.cookie.includes('orevami_auto_ads_refused=1'));assert.equal(f.mounts,0);w.close();
});
test('preferences do not invent acceptance without CMP; explicit CMP reconsent clears local refusal only',async()=>{
 const f=await fixture(),w=f.w;
 const button=w.document.getElementById('orevamiAdsPreferences');button.click();assert.match(w.document.getElementById('orevamiAdsConsentStatus').textContent,/CMP non configurée/);
 w.document.getElementById('orevamiWithdrawAdsConsent').click();let callback;
 w.__tcfapi=(cmd,_v,cb)=>{if(cmd==='addEventListener')callback=cb;};w.googlefc={callbackQueue:[],showRevocationMessage(){}};
 button.click();const data={cmpId:300,cmpStatus:'loaded',eventStatus:'tcloaded',gdprApplies:true,tcString:'fake-test-record',vendor:{consents:{755:true}},purpose:{consents:{1:true,3:true,4:true}}};
 callback(data,true);assert.equal(w.localStorage.getItem('orevami.autoAdsRefused'),'1');
 callback({...data,eventStatus:'useractioncomplete'},true);assert.equal(w.localStorage.getItem('orevami.autoAdsRefused'),null);assert(!w.document.cookie.includes('orevami_auto_ads_refused=1'));assert.equal(f.mounts,0);w.close();
});
