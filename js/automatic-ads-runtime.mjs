import {createAdSenseAdapter} from './ads-providers.mjs';
import {normalizeSettings,automaticReady,planSlots,AUTOMATIC_ADS_RELEASE_APPROVED} from './automatic-ads-policy.mjs';
const feed=document.getElementById('socialFeed');
function refused(){try{return localStorage.getItem('orevami.autoAdsRefused')==='1'||document.cookie.split('; ').includes('orevami_auto_ads_refused=1');}catch{return true;}}
let settings=normalizeSettings(), environment='', adapter=null, observer=null, timer=null, busy=false, denied=refused(), generation=0;
const attempts=new Set(); // One request per position per document; no refresh loop.
const cards=new Map();
function clean(){observer?.disconnect();observer=null;for(const card of cards.values())card.remove();cards.clear();}
function stop(){generation++;clean();adapter?.destroy();adapter=null;}
function home(){return location.hash==='#home' || location.hash==='' || location.hash==='#home/feed';}
function positions(){const posts=[...feed.children].filter(e=>e.classList.contains('socialPost'));const sponsored=[...feed.querySelectorAll(':scope > .adSponsored')].map(card=>posts.filter(post=>!!(post.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING)).length);return {posts,sponsored};}
function reconcile(){
 if(!feed)return;
 if(!home()||denied||!automaticReady(settings,environment)||!adapter?.available()){clean();return;}
 const {posts,sponsored}=positions(), planned=planSlots(posts.length,settings,sponsored);
 for(const [pos,card] of cards)if(!planned.includes(pos)||(attempts.has(pos)&&(!card.isConnected||card.previousElementSibling!==posts[pos-1]))){card.remove();cards.delete(pos);}
 observer?.disconnect();
 if(!('IntersectionObserver' in window))return; // Fail closed on unsupported browsers.
 observer=new IntersectionObserver(entries=>{for(const entry of entries){
  const pos=posts.indexOf(entry.target)+1,card=cards.get(pos);
  if(!card)continue;
  if(!entry.isIntersecting||attempts.has(pos))continue;
  observer.unobserve(entry.target);
  if(!home()||denied||!adapter?.available()||!automaticReady(settings,environment))continue;
  attempts.add(pos);
  posts[pos-1].after(card);
  try{if(!adapter.mount(card.querySelector('.automaticAdBody'))){card.remove();cards.delete(pos);}}catch{card.remove();cards.delete(pos);}
 }},{rootMargin:'200px'});
 for(const pos of planned){
  if(cards.has(pos)){if(!attempts.has(pos))observer.observe(posts[pos-1]);continue;}
  if(attempts.has(pos))continue;
  const card=document.createElement('aside');card.className='automaticAd';card.dataset.position=String(pos);card.setAttribute('aria-label','Publicité');
  const label=document.createElement('small');label.textContent='Publicité';
  const body=document.createElement('div');body.className='automaticAdBody';card.append(label,body);
  cards.set(pos,card);observer.observe(posts[pos-1]);
 }
}
function configure(){stop();if(!automaticReady(settings,environment)||denied)return;
 adapter=createAdSenseAdapter({environment,productionAuthorized:AUTOMATIC_ADS_RELEASE_APPROVED,publisherId:settings.publisher_id,slotId:settings.slot_id,certifiedCmpId:settings.cmp_id});
 if(!adapter.initialize(()=>reconcile())){adapter.destroy();adapter=null;}reconcile();
}
async function refresh(){
 if(busy||typeof sb==='undefined')return;busy=true;const seq=generation;
 try{const {data,error}=await sb.from('automatic_ad_settings').select('*').eq('id',true).single();
 if(seq!==generation)return;
 const next=normalizeSettings(error?{}:data);
 if(JSON.stringify(next)!==JSON.stringify(settings)){settings=next;configure();}
 else if(automaticReady(settings,environment)&&!adapter)configure();else reconcile();
 }catch{if(seq===generation){settings=normalizeSettings();stop();}}finally{busy=false;}
}
function suspend(){denied=true;try{localStorage.setItem('orevami.autoAdsRefused','1');}catch{}document.cookie='orevami_auto_ads_refused=1; Path=/; Max-Age=15552000; SameSite=Lax; Secure';stop();}
const withdraw=document.getElementById('orevamiWithdrawAdsConsent');
withdraw?.addEventListener('click',()=>{suspend();withdraw.textContent='Publicités automatiques refusées sur cet appareil';});
window.addEventListener('storage',e=>{if(e.key==='orevami.autoAdsRefused'&&e.newValue==='1'){denied=true;stop();}});
window.orevamiAutomaticAds=Object.freeze({refresh,suspend});
window.addEventListener('hashchange',()=>{if(!home())stop();else refresh();});
window.addEventListener('orevami:ads-consent-withdrawn',suspend);
window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null;stop();});
window.addEventListener('pageshow',()=>{if(environment){refresh();if(!timer&&AUTOMATIC_ADS_RELEASE_APPROVED)timer=setInterval(refresh,30000);}});
if(feed)new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.classList.contains('socialPost')||n.classList.contains('adSponsored')))))reconcile();}).observe(feed,{childList:true});
window.myeventRuntime?.ready.then(c=>{environment=c.environment;refresh();if(AUTOMATIC_ADS_RELEASE_APPROVED)timer=setInterval(()=>{if(!document.hidden)refresh();},30000);
 if(typeof sb!=='undefined')sb.auth.onAuthStateChange(()=>{stop();settings=normalizeSettings();setTimeout(refresh,0);});
}).catch(stop);
