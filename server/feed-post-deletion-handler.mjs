import {createHmac,timingSafeEqual} from 'node:crypto';
import {supabaseEnvironment} from './supabase-environment.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds={camera:{table:'social_posts',owner:'user_id'},event:{table:'event_feed_posts',owner:'author_id'}};
const safePath=(path,owner)=>typeof path==='string'&&path.startsWith(owner+'/')&&/^[a-zA-Z0-9_./-]+$/.test(path)&&!path.split('/').some(x=>!x||x==='.'||x==='..');
export function createFeedPostDeletion({fetchImpl=globalThis.fetch,environment=supabaseEnvironment,env=process.env,now=Date.now}={}){
 return async function feedPostDeletion(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
  const authorization=req.headers?.authorization;
  if(!/^Bearer \S+$/.test(authorization||''))return res.status(401).json({error:'Reconnecte-toi pour supprimer une publication.'});
  const {kind,id,cleanupReceipt}=req.body||{};
  if(!Object.hasOwn(kinds,kind)||!uuid.test(id||''))return res.status(400).json({error:'Publication invalide.'});
  let runtime;try{runtime=environment();}catch{return res.status(503).json({error:'Environnement indisponible. Publication conservée.'});}
  const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)return res.status(503).json({error:'Suppression sécurisée indisponible. Publication conservée.'});
  const normal={apikey:runtime.publishableKey,Authorization:authorization};
  const privileged={apikey:secret,...(secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+secret})};
  async function request(path,{method='GET',body,admin=false,representation=false}={}){
   const response=await fetchImpl(runtime.url+path,{method,headers:{...(admin?privileged:normal),'Content-Type':'application/json',...(representation?{Prefer:'return=representation'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Service '+response.status);
   return response.status===204?null:response.json();
  }
  const sign=value=>createHmac('sha256',secret).update('orevami-feed-cleanup-v1:'+value).digest('base64url');
  const receiptFor=value=>{const data=Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+sign(data);};
  function decodeReceipt(value){
   if(typeof value!=='string'||value.length>4096)throw Error('Invalid receipt');
   const [data,signature,...extra]=value.split('.'),expected=sign(data||'');
   if(extra.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error('Invalid receipt');
   const decoded=JSON.parse(Buffer.from(data,'base64url').toString());
   if(!Number.isFinite(decoded.expires)||decoded.expires<now())throw Error('Expired receipt');
   return decoded;
  }
  let deleted=false,receipt;
  try{
   const auth=await fetchImpl(runtime.url+'/auth/v1/user',{headers:normal,signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return res.status(401).json({error:'Ta session a expiré. Reconnecte-toi.'});
   const user=await auth.json();
   if(!uuid.test(user.id||''))return res.status(401).json({error:'Session invalide.'});
   // Role and account status come only from the existing database guard, never user metadata.
   const identity=await request('/rest/v1/rpc/myevent_admin_identity',{method:'POST',body:{}});
   if(identity?.user_id!==user.id||identity.account_active!==true)return res.status(403).json({error:'Ce compte ne peut pas supprimer de publication.'});
   const isAdmin=identity.is_admin===true&&identity.role==='super_admin';
   const {table,owner:ownerColumn}=kinds[kind];
   let mediaPath,owner;
   if(cleanupReceipt!==undefined){
    let claim;try{claim=decodeReceipt(cleanupReceipt);}catch{return res.status(400).json({error:'Reprise du nettoyage invalide ou expirée.'});}
    if(claim.actor!==user.id||claim.id!==id||claim.kind!==kind||kind!=='camera'||(!isAdmin&&claim.owner!==user.id))return res.status(403).json({error:'Nettoyage non autorisé.'});
    const remaining=await request('/rest/v1/'+table+'?id=eq.'+id+'&select=id',{admin:true});
    if(!Array.isArray(remaining)||remaining.length)return res.status(409).json({error:'Publication encore présente : média conservé.'});
    mediaPath=claim.path;owner=claim.owner;receipt=cleanupReceipt;deleted=true;
   }else{
    const rows=await request('/rest/v1/'+table+'?id=eq.'+id+'&select=id,'+ownerColumn+(kind==='camera'?',media_path':''),{admin:isAdmin});
    if(!Array.isArray(rows)||rows.length!==1)return res.status(404).json({error:'Publication introuvable ou accès refusé.'});
    const row=rows[0];owner=row[ownerColumn];mediaPath=kind==='camera'?row.media_path:null;
    if(!uuid.test(owner||'')||(!isAdmin&&owner!==user.id))return res.status(403).json({error:'Tu ne peux pas supprimer cette publication.'});
    // Authors still go through their existing RLS; administrator elevation is tightly scoped to this exact row and owner.
    const removed=await request('/rest/v1/'+table+'?id=eq.'+id+'&'+ownerColumn+'=eq.'+owner,{method:'DELETE',admin:isAdmin,representation:true});
    if(!Array.isArray(removed)||removed.length!==1||removed[0].id!==id)return res.status(409).json({error:'Suppression non confirmée. Actualise le fil.'});
    deleted=true;
    if(mediaPath&&safePath(mediaPath,owner))receipt=receiptFor({actor:user.id,kind,id,owner,path:mediaPath,expires:now()+3600000});
   }
   if(!mediaPath)return res.status(200).json({deleted:true,cleanupPending:false});
   // Event covers and other buckets are never touched; shared files are kept.
   if(!safePath(mediaPath,owner))return res.status(200).json({deleted:true,cleanupPending:true,error:'Publication supprimée. Média conservé : son chemin nécessite une vérification.'});
   const refs=await request('/rest/v1/social_posts?media_path=eq.'+encodeURIComponent(mediaPath)+'&select=id&limit=1',{admin:true});
   if(!Array.isArray(refs))throw Error('Invalid references');
   if(refs.length)return res.status(200).json({deleted:true,cleanupPending:false,mediaRetained:true});
   await request('/storage/v1/object/social-media',{method:'DELETE',body:{prefixes:[mediaPath]},admin:true});
   const check=await fetchImpl(runtime.url+'/storage/v1/object/info/social-media/'+mediaPath.split('/').map(encodeURIComponent).join('/'),{headers:privileged,signal:AbortSignal.timeout(10000)});
   if(check.status!==404)throw Error('Cleanup unconfirmed');
   return res.status(200).json({deleted:true,cleanupPending:false});
  }catch{
   // A signed, short-lived receipt allows retrying only the already-authorized cleanup, with a fresh account/role check.
   if(deleted)return res.status(200).json({deleted:true,cleanupPending:true,...(receipt?{cleanupReceipt:receipt}:{}),error:'Publication supprimée. Le nettoyage du média n’est pas confirmé.'});
   return res.status(503).json({error:'Suppression non confirmée. Actualise le fil avant de réessayer.'});
  }
 };
}
export default createFeedPostDeletion();
