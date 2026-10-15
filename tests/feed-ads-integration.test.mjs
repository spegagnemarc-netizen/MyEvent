import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
async function fixture({production=false,denied=false}={}){
 const dom=new JSDOM(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://preview.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];let change;let uid='reader-one';
 w.setInterval=()=>0;w.AbortSignal=globalThis.AbortSignal;
 w.sb={auth:{getSession:async()=>({data:{session:{access_token:'simulated',user:{id:uid}}}}),onAuthStateChange(fn){change=fn;}}};
 w.myeventRuntime={ready:Promise.resolve({environment:production?'production':'preview',isTest:!production,projectRef:production?'nxxvadbliinhvkirqkkl':'ahyyknfjsielnqyoxqgh'})};
 const feed=w.document.getElementById('socialFeed');feed.replaceChildren();
 for(let i=0;i<13;i++){const post=w.document.createElement('article');post.className='socialPost';post.innerHTML='<div class="socialPostHead">Auteur fictif</div><p>Publication '+i+'</p><img src="https://media.test/photo'+i+'"><video controls playsinline></video><button>J’aime</button>';feed.append(post);}
 const posts=[...feed.children];
 const campaign={id:'campaign-test',business:'Entreprise fictive TEST',title:'Annonce simulée',body:'Données locales uniquement',target_url:'https://example.test/offre',image_urls:['https://media.test/creative'],ends_at:'2099-01-01'};
 w.fetch=async(url,options)=>{assert.equal(url,'/api/create-payment-session');const body=JSON.parse(options.body);calls.push(body);
  const cat={plans:[{key:'discovery',name:'Découverte',price_cents:null,duration_days:null}],settings:{spacing:6,enabled:true,payments_enabled:false},capabilities:{signed_images:false,metrics:false,payments:false}};
  const data={ads_catalog:cat,ads_feed:uid==='reader-one'?[campaign,{...campaign,id:'second'}]:[],ads_mine:[],ads_history:[],ads_audit:[],ads_admin_list:{campaigns:[],revenue_cents:0,external:[],payments:[]}}[body.action]||{};
  return {ok:!(denied&&body.action==='ads_admin_list'),json:async()=>denied&&body.action==='ads_admin_list'?{error:'Accès administrateur refusé'}:data};
 };
 w.eval(read('js/feed-media-viewer.js'));w.eval(read('js/ads-runtime.js'));await settle();
 return {w,dom,calls,posts,switchUser:async()=>{uid='reader-two';change('SIGNED_IN',{user:{id:uid}});await settle();}};
}
test('sponsored cards coexist with compact galleries and keep existing post/video/like nodes',async()=>{
 const f=await fixture();try{const {w,posts}=f,feed=w.document.getElementById('socialFeed'),cards=[...feed.querySelectorAll('.adSponsored')];
  assert.equal(cards.length,2);assert.equal(posts[5].nextElementSibling,cards[0]);assert.equal(posts[11].nextElementSibling,cards[1]);
  assert.match(cards[0].textContent,/Sponsorisé/);assert(cards[0].querySelector('img.adVisual'));assert.equal(cards[0].querySelector('a').textContent,'En savoir plus');
  assert(!cards[0].querySelector('.socialPostPhotoButton'));assert.equal(feed.querySelectorAll('.socialPost').length,13);
  for(const post of posts){assert(feed.contains(post));assert(post.querySelector('video').controls);assert(post.querySelector('.socialFeedMediaGallery'));}
  const card=cards[0],button=posts[0].querySelector('button:not(.socialPostPhotoButton)');let clicks=0;button.onclick=()=>clicks++;button.click();assert.equal(clicks,1);
  const extra=w.document.createElement('article');extra.className='socialPost';feed.append(extra);await settle();assert.equal(feed.querySelector('.adSponsored'),card);
  assert(!w.document.querySelector('script[src*="googlesyndication"],ins.adsbygoogle'));
 }finally{f.w.close();}
});
test('account switch removes former sponsored content and resets consent and geography',async()=>{
 const f=await fixture();try{f.w.document.getElementById('myEventAdsAudienceZone').value='05';const check=f.w.document.getElementById('myEventAdsConsent');check.checked=true;check.dispatchEvent(new f.w.Event('change'));await f.switchUser();await new Promise(r=>setTimeout(r,10));await settle();
  assert.equal(f.w.document.querySelectorAll('.adSponsored').length,0);assert.equal(check.checked,false);assert.equal(f.w.document.getElementById('myEventAdsAudienceZone').value,'');assert(!f.calls.some(c=>c.action==='ads_metric'));
 }finally{f.w.close();}
});
test('Production makes no ads requests and keeps professional entry hidden',async()=>{const f=await fixture({production:true});try{assert.equal(f.calls.length,0);assert(f.w.document.getElementById('myEventAdsEntry').hidden);assert.equal(f.w.document.querySelectorAll('.adSponsored').length,0);}finally{f.w.close();}});
test('missing TEST capabilities and archived Essentiel are explicit without invented tariffs',async()=>{const f=await fixture();try{f.w.document.getElementById('myEventAdsEntry').click();await settle();assert.match(f.w.document.getElementById('myEventAdsPlans').textContent,/Essentiel.*inactive/s);assert.match(f.w.document.getElementById('myEventAdsPlans').textContent,/Tarif à configurer/);assert.match(f.w.document.getElementById('myEventAdsMessage').textContent,/clé serveur Supabase TEST/);await f.w.myeventAds.loadAdmin();assert(f.w.document.querySelector('#myEventAdminAds input[name="payments_enabled"]').disabled);}finally{f.w.close();}});
test('administrator denial exposes no campaign controls',async()=>{const f=await fixture({denied:true});try{await f.w.myeventAds.loadAdmin();assert.match(f.w.document.getElementById('myEventAdminAds').textContent,/refusé/);assert.equal(f.w.document.querySelectorAll('#myEventAdminAds form').length,0);}finally{f.w.close();}});
test('server payment lock blocks checkout even when a TEST key exists, before contacting Stripe',async()=>{
 const saved={...process.env},original=global.fetch;
 Object.assign(process.env,{VERCEL_ENV:'preview',SUPABASE_URL:'https://ahyyknfjsielnqyoxqgh.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_simulated',MYEVENT_TEST_SUPABASE_REF:'ahyyknfjsielnqyoxqgh',STRIPE_SECRET_KEY:'sk_test_simulated'});delete process.env.MYEVENT_ADS_TEST_PAYMENTS_ENABLED;
 const urls=[];global.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>({id:'simulated-user'})};};
 try{const {handler}=createRequire(import.meta.url)('../server/ads-handler.js');const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',headers:{authorization:'Bearer simulated'},body:{action:'ads_checkout',payload:{id:'simulated-campaign'}}},res);
  assert.equal(res.code,403);assert.match(res.body.error,/Paiements désactivés/);assert.equal(urls.length,1);assert(!urls.some(u=>u.includes('stripe.com')));
 }finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
test('compact card CSS and existing event deletion route are preserved',()=>{
 assert.match(read('css/ads.css'),/max-height:250px/);assert.match(read('css/event-social-feed.css'),/height:250px!important/);
 assert.match(read('index.html'),/sorties-reservations-runtime.js\?v=outing-pagination-2/);
 assert(JSON.parse(read('vercel.json')).routes.some(r=>r.dest==='/api/camera-ai?event_delete=1'));
});
