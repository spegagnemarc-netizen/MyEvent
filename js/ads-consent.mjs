// Preparation for an independently configured, Google-certified CMP.
// This module loads no script, sends no request and never mounts an advertisement.
export const GOOGLE_CMP_ID=300;
export function hasAdvertisingConsent(data,success,cmpId=GOOGLE_CMP_ID){
 if(success!==true||data?.cmpId!==cmpId||data?.cmpStatus!=='loaded'||data?.gdprApplies!==true||
 !['tcloaded','useractioncomplete'].includes(data?.eventStatus)||typeof data.tcString!=='string'||!data.tcString||
 data.vendor?.consents?.[755]!==true)return false;
 return [1,3,4].every(p=>data.purpose?.consents?.[p]===true &&
 (data.publisher?.restrictions?.[p]?.[755]===undefined||data.publisher.restrictions[p][755]===1));
}
export function createTcfConsentBridge({cmpId=GOOGLE_CMP_ID,onChange=()=>{}}={},scope=globalThis){
 let started=false,disposed=false,listenerId,accepted=false;
 function emit(value,eventStatus){accepted=value;onChange({accepted:value,eventStatus});}
 function remove(id){try{scope.__tcfapi?.('removeEventListener',2,()=>{},id);}catch{}}
 function initialize(){
  if(started||disposed||!Number.isInteger(cmpId)||cmpId<1||typeof scope.__tcfapi!=='function')return false;
  started=true;
  try{scope.__tcfapi('addEventListener',2,(data,success)=>{
   if(disposed){if(data?.listenerId!=null)remove(data.listenerId);return;}
   listenerId=data?.listenerId;
   emit(hasAdvertisingConsent(data,success,cmpId),data?.eventStatus);
  });return true;}catch{started=false;emit(false,'error');return false;}
 }
 // Google documents invoking this API only through callbackQueue. No loader/stub is inserted.
 function openPreferences(){
  if(disposed||cmpId!==GOOGLE_CMP_ID||!scope.googlefc?.callbackQueue?.push||typeof scope.googlefc.showRevocationMessage!=='function')return false;
  emit(false,'preferences');
  scope.googlefc.callbackQueue.push({CONSENT_API_READY:()=>{if(!disposed)scope.googlefc.showRevocationMessage();}});return true;
 }
 return Object.freeze({initialize,openPreferences,accepted:()=>accepted,destroy(){if(disposed)return;disposed=true;accepted=false;if(listenerId!=null)remove(listenerId);}});
}
