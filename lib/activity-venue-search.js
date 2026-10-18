// Public OSM data only. No scraping, arbitrary URL fetches or inferred opening/price data.
const endpoint='https://photon.komoot.io/api/';
let inFlight=0;
function text(v,max=500){return typeof v==='string'?v.trim().slice(0,max):null;}
function safeUrl(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function normalizeVenue(feature){
 const p=feature?.properties||{},raw=p.extra&&typeof p.extra==='object'?p.extra:{},coords=feature?.geometry?.coordinates;
 if(!Array.isArray(coords)||coords[0]==null||coords[1]==null||!Number.isFinite(coords[0])||!Number.isFinite(coords[1])||Math.abs(coords[0])>180||Math.abs(coords[1])>90)return null;
 // Named establishments, not a street/house match presented as a venue.
 if(!text(p.name,200)||!['amenity','leisure','tourism','sport','shop','club','craft','historic','office'].includes(p.osm_key))return null;
 const osmType={N:'node',W:'way',R:'relation',node:'node',way:'way',relation:'relation'}[p.osm_type],osmId=/^\d+$/.test(String(p.osm_id||''))?String(p.osm_id):null;
 if(!osmType||!osmId)return null;
 return {id:`osm-${osmType}-${osmId}`,name:text(p.name,200),category:text(p.osm_value,100),address:text([p.housenumber,p.street,p.postcode,p.city||p.town||p.village||p.locality].filter(Boolean).join(' '),300)||null,city:text(p.city||p.town||p.village||p.locality,100),lat:coords[1],lon:coords[0],website:safeUrl(raw.website||raw['contact:website']||p.website),phone:text(raw.phone||raw['contact:phone']||p.phone,80),opening_hours:text(raw.opening_hours||p.opening_hours),price:text(raw.charge||p.charge),booking_url:safeUrl(raw['reservation:website']||raw['booking:website']),source:'OpenStreetMap / Photon',source_url:`https://www.openstreetmap.org/${osmType}/${osmId}`,retrieved_at:new Date().toISOString()};
}
async function searchActivityVenues({q,city},{fetchImpl=fetch,enrich=true}={}){
 if(typeof q!=='string'||q.trim().length<3||q.length>160||/[\x00-\x1f]/.test(q)||city!=null&&(typeof city!=='string'||city.length>100||/[\x00-\x1f]/.test(city)))throw Object.assign(Error('Saisissez une recherche entre 3 et 160 caractères et une ville valide.'),{status:400});
 if(inFlight>=3)throw Object.assign(Error('Recherche occupée. Réessayez dans quelques instants.'),{status:429});
 const query=[q.trim(),city?.trim()].filter(Boolean).join(' '),url=new URL(endpoint);url.search=new URLSearchParams({q:query,limit:'15',lang:'fr'});
 inFlight++;try{const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'OREVAMI/1.3 (venue search; contact@orevami.com)'},signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('upstream');const data=await response.json();if(!Array.isArray(data?.features))throw Error('format');const unique=new Map();for(const f of data.features){const venue=normalizeVenue(f);if(venue&&!unique.has(venue.id))unique.set(venue.id,venue);}
 let partial=false,preferred=new Set();
 // Keep Photon as the engine: a category synonym fills vocabulary gaps without a new provider.
 if(enrich){const {categoryQuery}=require('./activity-venue-details'),intent=categoryQuery(query);if(intent){try{const aliasURL=new URL(endpoint);aliasURL.search=new URLSearchParams({q:intent.alias+' '+(city?.trim()||intent.city),limit:'10',lang:'fr'});const r=await fetchImpl(aliasURL,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.features))throw Error();for(const f of data.features){const v=normalizeVenue(f);if(v&&['ice_rink','sports_centre','stadium','ice_skating','ice_hockey'].includes(v.category)){preferred.add(v.id);unique.set(v.id,v);}}}catch{partial=true;}}}
 const ordered=[...unique.values()].sort((a,b)=>Number(preferred.has(b.id))-Number(preferred.has(a.id)));
 return {results:ordered.slice(0,15),source:'OpenStreetMap / Photon',attribution_url:'https://www.openstreetmap.org/copyright',partial,notice:partial?'Recherche par synonyme indisponible : premiers résultats Photon uniquement. Essayez aussi le nom exact du lieu.':'Informations déclarées dans OpenStreetMap, à confirmer auprès de l’établissement. Aucune disponibilité garantie.'};}catch{throw Object.assign(Error('La recherche de lieux est temporairement indisponible. Vous pouvez saisir le lieu manuellement.'),{status:503});}finally{inFlight--;}
}
module.exports={searchActivityVenues,normalizeVenue,safeUrl};
