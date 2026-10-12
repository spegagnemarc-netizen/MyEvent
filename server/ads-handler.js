// Only called by the existing payment function; no additional Vercel function.
const crypto=require('node:crypto');
const limits=new Map();
function sweep(now){for(const [k,v] of limits)if(v.until<=now)limits.delete(k);}
async function environment(){const {supabaseEnvironment}=await import('./supabase-environment.mjs');const c=supabaseEnvironment();if(!c.isTest||c.projectRef!=='ahyyknfjsielnqyoxqgh')throw Error('TEST_ONLY');return c;}
async function rpc(c,token,action,payload){const response=await fetch(c.url+'/rest/v1/rpc/myevent_ads',{method:'POST',headers:{apikey:c.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('RPC_'+response.status);return response.json();}
async function service(c,name,args){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('SERVICE_NOT_CONFIGURED');const r=await fetch(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('SERVICE_FAILED');return r.json();}
async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
 const c=await environment(),token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];if(!token)return res.status(401).json({error:'Connexion requise.'});
 const auth=await fetch(c.url+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!auth.ok)return res.status(401).json({error:'Session invalide.'});const uid=(await auth.json()).id;if(!uid)return res.status(401).json({error:'Session invalide.'});
 const now=Date.now();sweep(now);let rate=limits.get(uid);if(!rate){if(limits.size>=2000)return res.status(503).json({error:'Réessayez plus tard.'});rate={count:0,until:now+60000};limits.set(uid,rate);}if(++rate.count>40)return res.status(429).json({error:'Trop d’appels. Réessayez dans une minute.'});
 const body=req.body||{};if(Buffer.byteLength(JSON.stringify(body))>5000)return res.status(413).json({error:'Campagne trop volumineuse.'});const action=body.action?.replace(/^ads_/,''),payload=body.payload||{};
 if(action==='feed'){const rows=await rpc(c,token,'feed',{zone:payload.zone||''});return res.status(200).json(await images(c,rows.map(row=>({...row,metric_token:metricToken(row.id,uid,now)}))));}
 if(action==='metric'){
  if(payload.consent!==true)return res.status(200).json({counted:false});
  const receipt=readMetric(payload.token,uid,now),kind=payload.kind;
  if(!receipt||!['impression','click'].includes(kind))return res.status(200).json({counted:false});
  await rpc(c,token,'catalog',{});
  const counted=await service(c,'myevent_ads_count_once',{p_id:receipt.id,p_kind:kind,p_receipt:receipt.dedupe});
  return res.status(200).json({counted});
 } if(action==='checkout'){
  const key=process.env.STRIPE_SECRET_KEY;if(!/^sk_test_/.test(key||''))return res.status(503).json({error:'Stripe TEST non configuré. Paiement désactivé.'});
  let attempt=await rpc(c,token,'reserve_checkout',{id:payload.id});
  if(attempt.status==='processing'||attempt.status==='paid')return res.status(409).json({error:'Paiement en cours de vérification. Aucun nouveau paiement demandé.'});
  if(attempt.session_id){
   const existing=await stripeRequest(key,'/checkout/sessions/'+encodeURIComponent(attempt.session_id));
   if(existing.status==='open'&&existing.payment_status==='unpaid'&&existing.id===attempt.session_id&&/^https:\/\/checkout\.stripe\.com\//.test(existing.url||'')&&existing.metadata?.campaign_id===attempt.campaign_id)return res.status(200).json({url:existing.url,test:true});
   if(existing.status!=='expired')return res.status(409).json({error:'Paiement en cours de vérification. Aucun nouveau paiement demandé.'});
   await service(c,'myevent_ads_payment_event',{p_session:attempt.session_id,p_state:'expired'});
   attempt=await rpc(c,token,'reserve_checkout',{id:payload.id});
  }
  let host=process.env.VERCEL_URL;if(!/^[a-z0-9.-]+\.vercel\.app$/.test(host||''))throw Error('PREVIEW_URL_REQUIRED');if(req.headers.origin==='https://my-event-git-refactor-final-spegagnemarc-netizen.vercel.app')host='my-event-git-refactor-final-spegagnemarc-netizen.vercel.app';
  const params=new URLSearchParams({mode:'payment',success_url:'https://'+host+'/?ad_payment=returned',cancel_url:'https://'+host+'/?ad_payment=cancelled','payment_method_types[0]':'card','line_items[0][quantity]':'1','line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':String(attempt.amount_cents),'line_items[0][price_data][product_data][name]':'ORÉVAMI · Campagne TEST','metadata[myevent_kind]':'ads_test','metadata[campaign_id]':attempt.campaign_id,'metadata[attempt_id]':attempt.id,client_reference_id:attempt.id,expires_at:String(Math.floor(new Date(attempt.expires_at).getTime()/1000))});
  const data=await stripeRequest(key,'/checkout/sessions',params,'ads-test-'+attempt.id);
  if(!/^cs_test_/.test(data.id)||!/^https:\/\/checkout\.stripe\.com\//.test(data.url))throw Error('STRIPE_FAILED');
  await service(c,'myevent_ads_checkout_saved',{p_attempt:attempt.id,p_session:data.id,p_url:data.url});
  return res.status(200).json({url:data.url,test:true});
 } if(!['catalog','mine','create','admin_list','review','plan','settings','external_revenue','update','renew','history','audit','schedule','verify_advertiser'].includes(action))return res.status(400).json({error:'Action invalide.'});
 const result=await rpc(c,token,action,payload);if(action==='mine')return res.status(200).json(await images(c,result));if(action==='admin_list')result.campaigns=await images(c,result.campaigns);return res.status(200).json(result);
 }catch(e){const denied=e.message==='TEST_ONLY'||e.message==='RPC_403';return res.status(denied?403:503).json({error:denied?'Accès refusé. Régie réservée à l’environnement TEST.':'Régie indisponible : vérifier la migration TEST et la configuration serveur.'});}}
async function paid(event){const c=await environment(),s=event.data.object;if(event.livemode!==false||s.livemode!==false||s.payment_status!=='paid'||!/^sk_test_/.test(process.env.STRIPE_SECRET_KEY||''))throw Error('INVALID_TEST_PAYMENT');return service(c,'myevent_ads_paid',{p_id:s.metadata.campaign_id,p_session:s.id,p_amount:s.amount_total,p_currency:s.currency});}
async function paymentEvent(event){
 const c=await environment(),s=event.data.object;
 if(event.livemode!==false||s.livemode!==false||!/^sk_test_/.test(process.env.STRIPE_SECRET_KEY||'')||!/^cs_test_/.test(s.id||''))throw Error('INVALID_TEST_EVENT');
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&s.payment_status==='paid')return paid(event);
 const state={'checkout.session.expired':'expired','checkout.session.async_payment_failed':'failed','checkout.session.completed':'processing'}[event.type];
 if(state)return service(c,'myevent_ads_payment_event',{p_session:s.id,p_state:state});
}
function metricToken(id,uid,now){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return '';
 const dedupe=crypto.createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update('ads-day:'+Math.floor(now/86400000)+':'+uid+':'+id).digest('hex');
 const encoded=Buffer.from(JSON.stringify({id,uid,exp:now+300000,dedupe})).toString('base64url');
 return encoded+'.'+crypto.createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(encoded).digest('hex');
}
function readMetric(token,uid,now){try{
 const [encoded,signature]=String(token||'').split('.');if(!encoded||!/^[a-f0-9]{64}$/.test(signature||''))return null;
 const expected=crypto.createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(encoded).digest();
 if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex')))return null;
 const data=JSON.parse(Buffer.from(encoded,'base64url').toString());return data.uid===uid&&data.exp>now?data:null;
 }catch{return null;}}
async function stripeRequest(key,path,params,idempotency){
 const headers={Authorization:'Bearer '+key};if(params){headers['Content-Type']='application/x-www-form-urlencoded';headers['Idempotency-Key']=idempotency;}
 const r=await fetch('https://api.stripe.com/v1'+path,{method:params?'POST':'GET',headers,body:params?.toString(),signal:AbortSignal.timeout(10000)});
 const data=await r.json();if(!r.ok||data.livemode===true)throw Error('STRIPE_FAILED');return data;
}
async function images(c,rows){return Promise.all(rows.map(async row=>{
 const urls=[];for(const path of row.image_paths||[]){
  if(!/^[a-f0-9-]{36}\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path))continue;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)continue;
  const r=await fetch(c.url+'/storage/v1/object/sign/ad-media/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120}),signal:AbortSignal.timeout(5000)});
  if(r.ok){const data=await r.json();if(typeof data.signedURL==='string'&&data.signedURL.startsWith('/object/sign/ad-media/'))urls.push(c.url+'/storage/v1'+data.signedURL);}
 }
 return {...row,image_urls:urls};
}));}
module.exports={handler,paid,paymentEvent};
