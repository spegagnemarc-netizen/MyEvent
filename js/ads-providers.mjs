// Shared provider contract. AdMob needs a real native bridge/UMP integration.
export function createAdMobAdapter(){return Object.freeze({name:'AdMob',available:false,reason:'Application native et SDK AdMob/UMP à intégrer.'});}
export function createAdSenseAdapter(config={},scope=globalThis){
 let consent=false,listenerId,script=null;
 const configured=config.environment==='production'&&config.productionAuthorized===true&&/^ca-pub-\d{16}$/.test(config.publisherId||'')&&/^\d{10}$/.test(config.slotId||'')&&Number.isInteger(config.certifiedCmpId)&&config.certifiedCmpId>0;
 const available=()=>configured&&consent;
 function initialize(onChange=()=>{}){
  if(!configured||typeof scope.__tcfapi!=='function')return false;
  scope.__tcfapi('addEventListener',2,(data,success)=>{
   listenerId=data?.listenerId;
   // Conservative: no Google request outside a positively confirmed consent.
   consent=success===true&&data?.cmpStatus==='loaded'&&data.cmpId===config.certifiedCmpId&&['tcloaded','useractioncomplete'].includes(data.eventStatus)&&data.gdprApplies===true&&data.vendor?.consents?.[755]===true&&[1,3,4].every(p=>data.purpose?.consents?.[p]===true);
   if(!consent){script?.remove();script=null;scope.document?.querySelectorAll('[data-myevent-google-ad]').forEach(e=>e.remove());}
   onChange(available());
  });return true;
 }
 function mount(container){
  if(!available()||!container||container.querySelector('[data-myevent-google-ad]'))return false;
  if(!script){script=scope.document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(config.publisherId);scope.document.head.append(script);}
  const ins=scope.document.createElement('ins');ins.className='adsbygoogle';ins.dataset.myeventGoogleAd='';ins.style.display='block';ins.dataset.adClient=config.publisherId;ins.dataset.adSlot=config.slotId;ins.dataset.adFormat='fluid';container.append(ins);(scope.adsbygoogle=scope.adsbygoogle||[]).push({});return true;
 }
 return Object.freeze({name:'AdSense',available,initialize,mount,destroy(){consent=false;script?.remove();scope.document?.querySelectorAll('[data-myevent-google-ad]').forEach(e=>e.remove());if(listenerId&&scope.__tcfapi)scope.__tcfapi('removeEventListener',2,()=>{},listenerId);}});
}
