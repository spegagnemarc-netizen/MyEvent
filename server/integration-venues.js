// Environment-isolated venue read endpoint. Existing Production search routes are untouched.
function send(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
module.exports=async function handler(req,res){
 const environment=process.env.VERCEL_ENV,url=String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
 const allowed=(environment==='preview'&&url==='https://ahyyknfjsielnqyoxqgh.supabase.co')||(environment==='production'&&url==='https://nxxvadbliinhvkirqkkl.supabase.co');
 if(!allowed)return send(res,404,{error:'Recherche indisponible dans cet environnement.'});
 const mode=String(req.query?.mode||'');
 try{
  if(req.method==='POST'&&mode==='analyse-venue'){
   if(!/^application\/json(?:;|$)/i.test(String(req.headers?.['content-type']||'')))return send(res,415,{error:'Envoyez une URL au format JSON.'});
   let data=req.body;if(typeof data==='string'){if(data.length>3000)return send(res,400,{error:'Requête trop longue.'});try{data=JSON.parse(data);}catch{return send(res,400,{error:'Requête invalide.'});}}
   if(!data||typeof data.url!=='string'||data.url.length>2000)return send(res,400,{error:'Lien invalide.'});
   return send(res,200,await require('../lib/venue-analysis').analyseVenue(data.url));
  }
  if(req.method!=='GET'){res.setHeader('Allow','GET, POST');return send(res,405,{error:'Méthode non autorisée.'});}
  if(mode==='activity-venue')return send(res,200,await require('../lib/activity-venue-search').searchActivityVenues({q:req.query.q,city:req.query.city}));
  if(mode==='activity-venue-detail')return send(res,200,await require('../lib/activity-venue-details').venueDetails(req.query.id));
  return send(res,404,{error:'Recherche inconnue.'});
 }catch(error){return send(res,Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:503,{error:error.status?error.message:'Informations indisponibles. La saisie manuelle reste possible.'});}
};
