import {supabaseEnvironment} from './supabase-environment.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function eventDeletion(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
 const authorization=req.headers?.authorization;
 if(!/^Bearer \S+$/.test(authorization||''))return res.status(401).json({error:'Connexion requise.'});
 const id=req.body?.eventId;
 if(id!==undefined&&!uuid.test(id))return res.status(400).json({error:'Événement invalide.'});
 let runtime;
 try{runtime=supabaseEnvironment();}catch{return res.status(503).json({error:'Environnement indisponible.'});}
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)return res.status(503).json({error:'La suppression sécurisée est indisponible. Événement conservé.'});
 let deleted=false;
 const deadline=Date.now()+60000;
 async function request(path,body,privileged=true){
  const response=await fetch(runtime.url+path,{method:'POST',headers:{apikey:privileged?secret:runtime.publishableKey,Authorization:privileged?'Bearer '+secret:authorization,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Storage/RPC '+response.status);
  return response.status===204?null:response.json();
 }
 try{
  const auth=await fetch(runtime.url+'/auth/v1/user',{headers:{apikey:runtime.publishableKey,authorization},signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return res.status(401).json({error:'Reconnecte-toi pour supprimer cet événement.'});
  const user=await auth.json();
  if(!uuid.test(user.id||''))return res.status(401).json({error:'Session invalide.'});
  // Validate privileged credentials before the destructive transaction.
  let pending=await request('/rest/v1/rpc/event_storage_cleanup_pending',{p_owner_id:user.id});
  if(!Array.isArray(pending))throw Error('Inventaire invalide');
  if(id){
   await request('/rest/v1/rpc/delete_event',{p_event_id:id},false);
   deleted=true;
   pending=[{event_id:id}];
  }
  let cleanupPending=false;
  for(const job of pending){
   let complete=false;
   for(let batch=0;batch<24&&Date.now()<deadline;batch++){
    const items=await request('/rest/v1/rpc/event_storage_cleanup_items',{p_event_id:job.event_id,p_owner_id:user.id});
    if(!Array.isArray(items))throw Error('Inventaire invalide');
    if(!items.length){complete=true;break;}
    for(const bucket of ['event-media','event-voices']){
     const paths=items.filter(x=>x.bucket_id===bucket).map(x=>x.name);
     if(paths.some(path=>typeof path!=='string'||!path.startsWith(job.event_id+'/')))throw Error('Périmètre invalide');
     if(!paths.length)continue;
     // Actual binaries are removed via Storage API, never by deleting SQL metadata.
     const response=await fetch(runtime.url+'/storage/v1/object/'+bucket,{method:'DELETE',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths}),signal:AbortSignal.timeout(10000)});
     if(!response.ok)throw Error('Storage '+response.status);
    }
    // Re-read the remaining inventory; a 2xx response alone is not completion.
   }
   if(!complete)cleanupPending=true;
  }
  return res.status(200).json({deleted,cleanupPending});
 }catch{
  // The durable job survives timeout, network failure and partial batch deletion.
  if(deleted)return res.status(200).json({deleted:true,cleanupPending:true});
  return res.status(503).json({error:'Suppression non confirmée. Réessaie : la demande peut être reprise sans double suppression.'});
 }
}
