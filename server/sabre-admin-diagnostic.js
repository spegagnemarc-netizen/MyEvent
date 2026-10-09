const {createSabreProvider,accessToken,SabreError}=require('../lib/sabre-provider');
const {validate}=require('../js/accommodation-search-contract');
const policy=require('./sabre-admin-policy.json');
const CERT='https://api.cert.platform.sabre.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createHandler({env=process.env,fetcher=fetch,ownerUserId=policy.ownerUserId,now=Date.now,runtimeLoader=()=>import('./supabase-environment.mjs')}={}){
 let windowStart=0,used=0,busy=false,authWindow=0,authChecks=0;
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const fail=(status,code,error)=>res.status(status).json({code,error});
  if(env.VERCEL_ENV!=='preview')return fail(404,'NOT_FOUND','Diagnostic disponible uniquement en Preview.');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'METHOD_NOT_ALLOWED','Méthode non autorisée.');}
  const auth=req.headers?.authorization;
  if(typeof auth!=='string'||auth.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(auth))return fail(401,'AUTH_REQUIRED','Connexion administrateur requise.');
  if(!UUID.test(ownerUserId||''))return fail(503,'OWNER_NOT_CONFIRMED','Diagnostic verrouillé : identité du propriétaire non confirmée côté serveur.');
  if(now()-authWindow>=60000){authWindow=now();authChecks=0;}
  if(authChecks++>=20){res.setHeader('Retry-After','60');return fail(429,'RATE_LIMIT','Vérifications de session temporairement limitées.');}
  try{
   const runtime=(await runtimeLoader()).supabaseEnvironment(env);
   if(!runtime.isTest||runtime.environment!=='preview')return fail(403,'PREVIEW_REQUIRED','Environnement de test requis.');
   const headers={authorization:auth,apikey:runtime.publishableKey,'Content-Type':'application/json'};
   const userResponse=await fetcher(runtime.url+'/auth/v1/user',{headers,redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!userResponse.ok)return fail(userResponse.status>=500?503:401,'SESSION_UNVERIFIED','Impossible de vérifier la session.');
   const user=await userResponse.json();
   if(user.id!==ownerUserId)return fail(403,'OWNER_REQUIRED','Accès réservé au propriétaire administrateur.');
   for(const name of ['myevent_is_admin','myevent_account_active']){
    const r=await fetcher(runtime.url+'/rest/v1/rpc/'+name,{method:'POST',headers,body:'{}',redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!r.ok||await r.json()!==true)return fail(403,'ADMIN_UNVERIFIED','Permissions administrateur non confirmées.');
   }
  }catch{return fail(503,'ADMIN_UNVERIFIED','Vérification administrateur indisponible : accès refusé.');}
  const q=req.body||{};
  if(!['connection','search','compare'].includes(q.action))return fail(400,'INVALID_ACTION','Action inconnue.');
  if(q.action!=='connection'){
   const error=validate(q);if(error)return fail(400,'INVALID_SEARCH',error);
   if(q.destination!=='Paris'||q.type!=='hotel'||q.guests!==2||q.rooms!==1||!['S5OM',''].includes(q.pcc))return fail(400,'INVALID_SEARCH','Test limité à Paris, 2 adultes, 1 chambre, avec S5OM ou sans PCC.');
  }
  // Owner-only, bounded operations; this limiter is per server instance.
  if(now()-windowStart>=600000){windowStart=now();used=0;}
  if(busy||used>=3){res.setHeader('Retry-After','600');return fail(429,'RATE_LIMIT','Trois diagnostics maximum par dix minutes et par instance. Réessaie plus tard.');}
  used++;busy=true;
  const statuses={oauth:[],availability:[]};
  let attempted=false;
  const tracked=async(url,options)=>{attempted=true;const r=await fetcher(url,options);if(url===CERT+'/v2/auth/token')statuses.oauth.push(r.status);if(url===CERT+'/v5/get/hotelavail')statuses.availability.push(r.status);return r;};
  try{
   const base=env.SABRE_API_BASE_URL;
   if(base!==CERT)throw new SabreError('SABRE_CERT_BASE_INVALID','configuration','L’origine CERT doit être exactement https://api.cert.platform.sabre.com.',{exactCertOrigin:false});
   if(!env.SABRE_USERNAME||!env.SABRE_PASSWORD)throw new SabreError('SABRE_CONFIG_MISSING','configuration','Identifiants Sabre serveur absents.');
   await accessToken(env,tracked,CERT,true);
   const cases=[];
   if(q.action!=='connection')for(const pcc of q.action==='compare'?['','S5OM']:[q.pcc]){
    const caseStatuses=[],warningCodes=new Set();
    const provider=createSabreProvider({env,fetcher:async(url,options)=>{
     if(url===CERT+'/v5/get/hotelavail'){
      const payload=JSON.parse(options.body);if(pcc)payload.GetHotelAvailRQ.POS={Source:{PseudoCityCode:pcc}};
      const r=await tracked(url,{...options,body:JSON.stringify(payload)});caseStatuses.push(r.status);
      try{const data=await r.clone().json();for(const warning of data.GetHotelAvailRS?.ApplicationResults?.Warning||[])for(const system of warning.SystemSpecificResults||[])for(const message of system.Message||[])if(/^[A-Za-z0-9_.-]{1,80}$/.test(message.code||''))warningCodes.add(message.code);}catch{}
      return r;
     }
     return tracked(url,options);
    }});
    try{const data=await provider.search({destination:'Paris',checkIn:q.checkIn,checkOut:q.checkOut,guests:2,rooms:1,type:'hotel',lat:48.8566,lon:2.3522});cases.push({pcc:pcc||null,http:caseStatuses,status:data.status,hotelCount:data.results.length,hotels:data.results,warnings:data.warnings,warningCodes:[...new Set([...warningCodes,...(data.diagnostics?.warningCodes||[])])],applicationStatus:data.diagnostics?.applicationStatus});}
    catch(error){cases.push({pcc:pcc||null,http:caseStatuses,warningCodes:[...warningCodes],code:error instanceof SabreError?error.code:'SABRE_REQUEST_FAILED',error:error instanceof SabreError?error.message:'Recherche Sabre indisponible.',permissionsError:caseStatuses.some(s=>s===401||s===403)});}
   }
   return res.status(200).json({real:true,environment:'cert',originVerified:true,oauthHttp:statuses.oauth,connection:'connected',cases,bookingAvailable:false});
  }catch(error){return res.status(502).json({real:attempted,environment:'cert',originVerified:env.SABRE_API_BASE_URL===CERT,oauthHttp:statuses.oauth,availabilityHttp:statuses.availability,code:error instanceof SabreError?error.code:'SABRE_REQUEST_FAILED',error:error instanceof SabreError?error.message:'Connexion Sabre indisponible.',permissionsError:[...statuses.oauth,...statuses.availability].some(s=>s===401||s===403)});}
  finally{busy=false;}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
