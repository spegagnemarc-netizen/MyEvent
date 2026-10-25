const {createHmac}=require('node:crypto');
const BASE='https://orevami-api-staging.onrender.com';
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
 try{
  if(process.env.VERCEL_ENV!=='preview')fail(404,'Indisponible.');
  if(!['GET','POST'].includes(req.method))fail(405,'Méthode non autorisée.');
  if(req.method==='POST'&&req.headers.origin!=='https://'+req.headers.host)fail(403,'Origine invalide.');
  const {supabaseEnvironment}=await import('./supabase-environment.mjs');const runtime=supabaseEnvironment();
  const authorization=req.headers.authorization;
  if(!/^Bearer \S+$/.test(authorization||''))fail(401,'Connecte-toi.');
  const headers={authorization,apikey:runtime.publishableKey,'Content-Type':'application/json'};
  const call=async(url,options={})=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
  const auth=await call(runtime.url+'/auth/v1/user',{headers});if(!auth.ok)fail(401,'Session expirée.');const user=await auth.json();if(!user.id)fail(401,'Session invalide.');
  const token=process.env.OREVAMI_API_PARTNER_TOKEN,access=process.env.OREVAMI_API_STAGING_ACCESS;
  if(!token||!access)fail(503,'La connexion restaurant staging attend sa configuration serveur.');
  const upstream=async(path,method='GET',body,key)=>{
   const r=await call(BASE+path,{method,headers:{Authorization:'Bearer '+token,'X-Staging-Access':access,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const j=await r.json();if(!r.ok)fail(r.status>=500?502:r.status,j.error?.message||'API restaurant indisponible.');return j.data;
  };
  if(req.method==='GET'&&!req.query?.id)return res.status(200).json({data:await upstream('/v1/restaurants')});
  const id=req.method==='GET'?req.query.id:req.body?.id;
  if(!/^[a-f0-9-]{36}$/.test(id||''))fail(400,'Référence invalide.');
  const url=runtime.url+'/rest/v1/personal_reservations?id=eq.'+id+'&owner_id=eq.'+encodeURIComponent(user.id);
  const r=await call(url+'&select=*',{headers});if(!r.ok)fail(403,'Réservation inaccessible.');const row=(await r.json())[0];
  if(!row||row.kind!=='restaurant')fail(404,'Réservation inaccessible.');
  const sign=value=>createHmac('sha256',token).update(JSON.stringify([user.id,id,value])).digest('hex');
  let booking;
  if(req.method==='GET'){
   if(!row.details.api_booking_id||row.details.api_binding!==sign(row.details.api_booking_id))fail(409,'Demande non envoyée. Reprends son envoi.');
   booking=await upstream('/v1/bookings/'+encodeURIComponent(row.details.api_booking_id));
  }else{
   const input=row.details.api_request;
   if(!input||input.vertical!=='restaurant'||!input.slotId)fail(400,'Créneau restaurant requis.');
   const catalog=await upstream('/v1/restaurants');
   const item=catalog.find(x=>x.offer.id===input.resourceId),slot=item?.slots.find(s=>s.id===input.slotId);
   if(!slot||input.startsAt!==slot.startsAt||input.endsAt!==slot.endsAt)fail(400,'Créneau invalide.');
   const key=sign(input);booking=await upstream('/v1/bookings','POST',input,key);
   booking=await upstream('/v1/bookings/'+encodeURIComponent(booking.id));
  }
  const details={...row.details,api_booking_id:booking.id,api_binding:sign(booking.id),api_status:booking.status};
  const saved=await call(url,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({details})});
  if(!saved.ok)fail(503,'Demande reçue par le restaurant ; synchronisation à reprendre avec la même réservation.');
  return res.status(200).json({data:booking});
 }catch(e){return res.status(e.status||502).json({error:e.status?e.message:'Connexion restaurant indisponible. Réessaie la même demande.'});}
};
