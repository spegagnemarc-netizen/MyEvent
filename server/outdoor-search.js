// Read-only discovery. No database, credentials or user data are used here.
const cache = new Map(), pending = new Map(), cooling = new Map();
const OVERPASS = ['https://ovp.dresel.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let activeProvider=false, lastProvider=0;
const TTL = 6 * 60 * 60 * 1000;
const fail = (message, status=503) => Object.assign(new Error(message), {status});
async function json(url, timeout=12000) {
  const r = await fetch(url, {signal:AbortSignal.timeout(timeout), headers:{Accept:'application/json','User-Agent':'Orevami-outdoor/1.1 (https://orevami.com)'}});
  if(!r.ok) throw fail('Fournisseur géographique indisponible ('+r.status+').');
  const raw = await r.text();
  if(raw.length>18000000) throw fail('Réponse géographique trop volumineuse. Réduisez le rayon.');
  return JSON.parse(raw);
}
async function memo(key, fn) {
  const old=cache.get(key);
  if(old && old.until>Date.now()) {if(old.error)throw old.error;return old.value;}
  if(pending.has(key))return pending.get(key);
  if(pending.size>=3)throw fail('Recherche occupée. Réessayez dans une minute.',429);
  const p=fn().then(value=>{cache.set(key,{value,until:Date.now()+TTL});return value;},error=>{cache.set(key,{error,until:Date.now()+60000});throw error;}).finally(()=>pending.delete(key));
  pending.set(key,p);
  if(cache.size>200)cache.delete(cache.keys().next().value);
  return p;
}
async function communes(input) {
  const text=String(input||'').trim();
  if(text.length<2||text.length>100)throw fail('Saisissez une commune française ou un code postal.',400);
  const match=text.match(/^(.*?)\s*\(?\b(\d{2,3}|2[AB])\)?$/i);
  const postal=/^\d{5}$/.test(text);
  const params=new URLSearchParams({fields:'nom,code,codeDepartement,centre',boost:'population',limit:'8'});
  params.set(postal?'codePostal':'nom',postal?text:(match?.[1]?.trim()||text));
  if(!postal&&match?.[1]?.trim())params.set('codeDepartement',match[2].toUpperCase());
  return memo('commune:'+params,async()=>{
    const rows=await json('https://geo.api.gouv.fr/communes?'+params);
    if(!Array.isArray(rows))throw fail('Réponse de géocodage invalide.');
    return {communes:rows.filter(c=>c.centre?.coordinates?.length===2),source:'API Découpage administratif · geo.api.gouv.fr'};
  });
}
async function discover(params) {
  const lon=Number(params.get('lon')),lat=Number(params.get('lat')),radius=Number(params.get('radius')||20);
  if(!params.has('lon')||!params.has('lat')||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85||![5,20,50].includes(radius))throw fail('Localisation ou rayon invalide (5, 20 ou 50 km).',400);
  // Search all supported route practices once: changing local filters makes no provider call.
  const key=['routes',lon.toFixed(4),lat.toFixed(4),radius].join(':');
  return memo(key,async()=>{
    if(activeProvider||Date.now()-lastProvider<2000)throw fail('Recherche occupée. Réessayez dans une minute.',429);
    activeProvider=true;lastProvider=Date.now();
    try {
    const core=await import('../js/outdoor-core.mjs');
    const query=`[out:json][timeout:20][maxsize:16777216];relation(around:${radius*1000},${lat.toFixed(4)},${lon.toFixed(4)})[type=route][route~"^(hiking|foot|bicycle|mtb)$"];out geom 100;`;
    let data,provider;
    for(const endpoint of OVERPASS){
      if(endpoint.includes('dresel')&&(lon < -25||lon > 45||lat < 34||lat > 72))continue;
      if((cooling.get(endpoint)||0)>Date.now())continue;
      try{data=await json(endpoint+'?data='+encodeURIComponent(query),25000);if(data.remark||!Array.isArray(data.elements))throw fail('Réponse Overpass incomplète.');provider=endpoint;break;}
      catch{cooling.set(endpoint,Date.now()+60000);}
    }
    if(!data||!provider)throw fail('Découverte OpenStreetMap indisponible. Réessayez plus tard ; vos parcours personnels restent accessibles.');
    const checked=new Date().toISOString(),routes=[];let excluded=0;
    for(const el of data.elements){try{const r=core.fromOSM(el,checked);if(core.filterRoutes([r],{center:[lon,lat],radius}).length)routes.push(r);else excluded++;}catch{excluded++;}}
    return {routes,provider,checked_at:checked,excluded,limited:data.elements.length>=100,attribution:'© contributeurs OpenStreetMap · ODbL-1.0',notice:'Relations d’itinéraires cartographiées, sans vérification de terrain. Couverture communautaire non exhaustive. Aucun chemin isolé converti en circuit.'};
    } finally {activeProvider=false;}
  });
}
async function calculate(params){
 const routing=require('./outdoor-routing'),input=routing.parameters(params);
 // The public provider budget is shared with discovery; no automatic retries in the UI.
 if(activeProvider||Date.now()-lastProvider<2000)throw fail('Calcul occupé. Réessayez dans quelques secondes.',429);
 activeProvider=true;lastProvider=Date.now();
 try{
  const query=`[out:json][timeout:20][maxsize:16777216];way(${input.bbox.map(v=>v.toFixed(5)).join(',')})[highway];out geom 5000;`;
  let data;
  for(const endpoint of OVERPASS){
   if(endpoint.includes('dresel')&&(input.bbox[1]<-25||input.bbox[3]>45||input.bbox[0]<34||input.bbox[2]>72))continue;
   if((cooling.get(endpoint)||0)>Date.now())continue;
   try{data=await json(endpoint+'?data='+encodeURIComponent(query),25000);if(data.remark||!Array.isArray(data.elements))throw fail('Réseau incomplet.');break;}catch{data=null;cooling.set(endpoint,Date.now()+60000);}
  }
  if(!data)throw fail('Réseau OSM indisponible : aucun itinéraire calculé. Réessayez plus tard.');
  const result=routing.route(data.elements,input),core=await import('../js/outdoor-core.mjs');
  return {...result,...core.metrics(result.geometry,input.mode),source_name:'Calcul sur réseau OpenStreetMap',source_url:'https://www.openstreetmap.org/copyright',license:'ODbL-1.0',checked_at:new Date().toISOString()};
 }finally{activeProvider=false;}
}
async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Méthode non autorisée.'});}
  try{
    const params=new URL(req.url,'https://orevami.com').searchParams;
    const value=params.get('kind')==='routing'?await calculate(params):params.has('commune')?await communes(params.get('commune')):await discover(params);
    res.setHeader('Cache-Control',params.get('kind')==='routing'?'private, no-store':'public, max-age=0, s-maxage=21600');
    return res.status(200).json(value);
  }catch(e){res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');return res.status(e.status||503).json({error:e.message||'Recherche géographique indisponible.'});}
}
module.exports=handler;
module.exports._test={communes,discover,calculate,cache,pending,cooling};
