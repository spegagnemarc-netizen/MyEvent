// Server only: never return provider URLs, keys or raw upstream errors.
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function distanceKm(a,b,c,d){const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,k=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,k)));}
function safeUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch(_){return null;}}
function normalizeFeature(f,lat,lon){
  const p=f.properties||{},raw=p.datasource?.raw||{},a=p.lat??f.geometry?.coordinates?.[1],o=p.lon??f.geometry?.coordinates?.[0];
  if(a==null||o==null||!Number.isFinite(Number(a))||!Number.isFinite(Number(o))||Math.abs(a)>90||Math.abs(o)>180||!p.name)return null;
  return {id:p.place_id?`geoapify-${p.place_id}`:`geoapify-${normalize(p.name)}-${a}-${o}`,place_id:p.place_id||null,name:p.name,type:'restaurant',source:'geoapify',address:p.formatted||[p.address_line1,p.address_line2].filter(Boolean).join(', '),lat:Number(a),lon:Number(o),distance:distanceKm(lat,lon,Number(a),Number(o)),price:null,
    cuisine:p.catering?.cuisine||raw.cuisine||null,opening_hours:p.opening_hours||raw.opening_hours||null,phone:p.contact?.phone||raw.phone||raw['contact:phone']||null,website:safeUrl(p.website||p.contact?.website||raw.website||raw['contact:website']),wheelchair:p.facilities?.wheelchair??raw.wheelchair??null,terrace:p.facilities?.outdoor_seating??raw.outdoor_seating??null,vegetarian:p.catering?.diet?.vegetarian??raw['diet:vegetarian']??null,vegan:p.catering?.diet?.vegan??raw['diet:vegan']??null};
}
function deduplicate(items){const kept=[];for(const p of items){if(kept.some(x=>(p.place_id&&x.place_id===p.place_id)||(normalize(p.name)===normalize(x.name)&&((normalize(p.address)&&normalize(p.address)===normalize(x.address))||distanceKm(p.lat,p.lon,x.lat,x.lon)<0.06))))continue;kept.push(p);}return kept;}
async function searchRestaurants({lat,lon,radius}, {fetchImpl=fetch,key=process.env.GEOAPIFY_API_KEY}={}){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||![5,20,50,100].includes(radius))throw Object.assign(Error('Coordonnées ou rayon invalide.'),{status:400});
  if(!key)throw Object.assign(Error('La recherche de restaurants est indisponible.'),{status:503});
  const url=new URL('https://api.geoapify.com/v2/places');url.search=new URLSearchParams({categories:'catering.restaurant',filter:`circle:${lon},${lat},${radius*1000}`,bias:`proximity:${lon},${lat}`,limit:'200',apiKey:key});
  let data;
  for(let attempt=0;attempt<2;attempt++){
    try{const r=await fetchImpl(url,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}});if(!r.ok){if(attempt===0&&r.status>=500)continue;throw Error('upstream');}data=await r.json();break;}catch(_){if(attempt===1)throw Object.assign(Error('Geoapify est temporairement indisponible.'),{status:502});}
  }
  if(!Array.isArray(data?.features))throw Object.assign(Error('Réponse Geoapify invalide.'),{status:502});
  const results=deduplicate(data.features.map(f=>normalizeFeature(f,lat,lon)).filter(p=>p&&p.distance<=radius)).sort((a,b)=>a.distance-b.distance);
  return {results,count:results.length,radius,source:'Geoapify / OpenStreetMap',warnings:[],truncated:data.features.length===200};
}
module.exports={searchRestaurants,normalizeFeature,deduplicate,distanceKm};
