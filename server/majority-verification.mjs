import {createHash,randomBytes} from 'node:crypto';

const unavailable=()=>{throw Error('Vérification de majorité indisponible.');};
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Preparation only: no HTTP route, credentials, provider account or activation.
// The selected provider's adapter must implement these operations using its signed,
// authenticated server API. It must never normalise a browser/callback payload as a result.
export function majorityVerification({enabled=false,provider,auth,store,allowedHostedOrigins=[]}={}){
 function ready(){if(!enabled||provider?.name!=='yoti'||!auth?.getUser||!store?.begin||!store?.complete||!provider?.createSession||!provider?.getResult)unavailable();}
 async function user(token){
  if(typeof token!=='string'||!token||token.length>8192)unavailable();
  const result=await auth.getUser(token);const id=result?.data?.user?.id;
  if(result?.error||!uuid.test(id||'')||result.data.user.is_anonymous===true)unavailable();
  return id;
 }
 return Object.freeze({
  async start(accessToken){
   ready();const userId=await user(accessToken),binding=randomBytes(32).toString('hex');
   // Never pass email, birth date, name or Supabase UID to the provider.
   const session=await provider.createSession({binding,threshold:18});
   if(typeof session?.id!=='string'||!session.id||session.id.length>512)unavailable();
   let url;try{url=new URL(session.url);}catch{unavailable();}
   if(url.protocol!=='https:'||url.username||url.password||!allowedHostedOrigins.includes(url.origin))unavailable();
   const sessionHash=hash(session.id+'\0'+binding);
   await store.begin(userId,sessionHash);
   // Receipt is an opaque lookup reference, not evidence of adulthood.
   return {url:url.href,receipt:{sessionId:session.id,binding}};
  },
  async complete(accessToken,receipt){
   ready();const userId=await user(accessToken);
   const {sessionId,binding}=receipt||{};
   if(typeof sessionId!=='string'||!sessionId||sessionId.length>512||typeof binding!=='string'||!/^[a-f0-9]{64}$/.test(binding))unavailable();
   const result=await provider.getResult(sessionId);
   if(result?.sessionId!==sessionId||result?.binding!==binding||result?.threshold!==18)unavailable();
   if(result.status==='pending')return {verified:false,pending:true};
   if(!['complete','rejected'].includes(result.status)||typeof result.over18!=='boolean')unavailable();
   const passed=result.status==='complete'&&result.over18===true;
   const verified=await store.complete(userId,hash(sessionId+'\0'+binding),passed);
   return {verified:verified===true,pending:false};
  }
 });
}

// A server-only Supabase client with service credentials is injected by the future
// route. It must never share the browser client/session or be serialised to it.
export function majorityStore(serviceClient){
 const call=async(name,args)=>{const result=await serviceClient.rpc(name,args);if(result.error)unavailable();return result.data;};
 return Object.freeze({
  begin:(userId,sessionHash)=>call('activities_majority_begin',{p_user:userId,p_hash:sessionHash}),
  complete:(userId,sessionHash,over18)=>call('activities_majority_complete',{p_user:userId,p_hash:sessionHash,p_over18:over18})
 });
}
