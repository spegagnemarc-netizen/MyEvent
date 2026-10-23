// Prepared from official AVS documentation, 2026-10-20. No live call or new test.
// Not imported by any HTTP route. Explicit enablement and approved contract required.
const origin='https://age.yoti.com';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable=()=>{throw Error('Vérification Yoti indisponible.');};

export function yotiAgeAdapter({enabled=false,apiKey,sdkId,returnUrl,allowDocumentFallback=false,fetchImpl=globalThis.fetch}={}){
 function ready(){
  if(enabled!==true||typeof apiKey!=='string'||!apiKey||/[\r\n]/.test(apiKey)||!uuid.test(sdkId||'')||typeof fetchImpl!=='function')unavailable();
 }
 async function request(path,method='GET',data){
  ready();
  try{
   const response=await fetchImpl(origin+'/api/v1/'+path,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+apiKey,'Yoti-SDK-Id':sdkId,'Content-Type':'application/json',Accept:'application/json'},...(data?{body:JSON.stringify(data)}:{})});
   if(!response.ok)unavailable();
   const reader=response.body?.getReader();if(!reader)unavailable();
   let size=0;const chunks=[];
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();unavailable();}chunks.push(part.value);}
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{unavailable();} // Never return provider bodies, credentials or user evidence in errors.
 }
 return Object.freeze({
  name:'yoti',
  async createSession({binding,threshold}){
   ready();if(threshold!==18||typeof binding!=='string'||!/^[a-f0-9]{64}$/.test(binding))unavailable();
   let callback;try{callback=new URL(returnUrl);}catch{unavailable();}
   if(callback.protocol!=='https:'||callback.username||callback.password||callback.search||callback.hash)unavailable();
   const result=await request('sessions','POST',{
    type:'OVER',ttl:900,reference_id:binding,
    callback:{auto:true,url:callback.href},retry_enabled:false,resume_enabled:false,
    // No facial estimate substituted for a document-backed Digital ID credential.
    digital_id:{allowed:true,threshold:18,age_estimation_allowed:false,retry_limit:1},
    age_estimation:{allowed:false},
    doc_scan:{allowed:allowDocumentFallback===true,...(allowDocumentFallback===true?{threshold:18,authenticity:'AUTO',level:'PASSIVE',preset_issuing_country:'FRA',retry_limit:1}:{})},
    credit_card:{allowed:false},mobile:{allowed:false},email:{allowed:false},
    yoti_key:{allowed:false},electronic_id:{allowed:false},la_wallet:{allowed:false},
    social_security_number:{allowed:false},us_florida_hb3:{allowed:false},singpass:{allowed:false},cpf:{allowed:false}
   });
   if(!uuid.test(result?.id||'')||result.status!=='PENDING'||!Number.isFinite(Date.parse(result.expires_at))||Date.parse(result.expires_at)<=Date.now())unavailable();
   const url=new URL(origin);url.searchParams.set('sessionId',result.id);url.searchParams.set('sdkId',sdkId);url.searchParams.set('locale','fr');
   return {id:result.id,url:url.href};
  },
  async getResult(sessionId){
   ready();if(!uuid.test(sessionId||''))unavailable();
   const result=await request('sessions/'+encodeURIComponent(sessionId)+'/result');
   if(result?.id!==sessionId||result?.sdk_id!==sdkId||result.type!=='OVER'||typeof result.reference_id!=='string'||!/^[a-f0-9]{64}$/.test(result.reference_id))unavailable();
   const base={sessionId,binding:result.reference_id,threshold:18};
   if(['PENDING','IN_PROGRESS','PROCESSING'].includes(result.status))return {...base,status:'pending'};
   if(['FAIL','ERROR','CANCELLED','EXPIRED'].includes(result.status))return {...base,status:'rejected',over18:false};
   if(result.status!=='COMPLETE')unavailable();
   const method=result.method==='DIGITAL_ID'?'digital_id':allowDocumentFallback===true&&result.method==='DOC_SCAN'?'doc_scan':null;
   if(!method||result[method]?.allowed!==true||result[method]?.threshold!==18||result.age!==18)unavailable();
   if(method==='digital_id'&&result.digital_id.age_estimation_allowed===true)unavailable();
   if(!Number.isFinite(Date.parse(result.expires_at))||Date.parse(result.expires_at)<=Date.now())unavailable();
   return {...base,status:'complete',over18:true};
  }
 });
}
