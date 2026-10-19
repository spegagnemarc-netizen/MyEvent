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
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const types=require('../js/activities-core').activityTypes;
function intent(q,city){
 const value=fold(q),type=[...types].sort((a,b)=>b.label.length-a.label.length).find(t=>value===fold(t.label)||value.startsWith(fold(t.label)+' '));
 if(type)return {term:type.label,type:type.id,city:q.slice(type.label.length).replace(/^\s+(?:à|a|de|en)\s+/i,' ').trim()||city?.trim()||''};
 const split=q.match(/^(.+?)\s+(?:à|a|en)\s+(.+)$/i);
 return {term:split?.[1]||q,type:null,city:split?.[2]||city?.trim()||''};
}
function french(p){return !p.countrycode||p.countrycode.toUpperCase()==='FR';}
function sameCity(a,b){const x=fold(a),y=fold(b);return x===y||x.startsWith(y+' ')&&/arrondissement/.test(x);}
async function photon(params,fetchImpl){const url=new URL(endpoint);url.search=new URLSearchParams({limit:'30',lang:'fr',countrycode:'FR',...params});const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'OREVAMI/1.3 (venue search; contact@orevami.com)'},signal:AbortSignal.timeout(6500)});if(!response.ok)throw Error('provider');const data=await response.json();if(!Array.isArray(data.features))throw Error('format');return data.features.filter(f=>french(f.properties||{}));}
function cityFeature(f,name){const p=f.properties||{},c=f.geometry?.coordinates;return ['city','town','village','municipality'].includes(p.osm_value)&&sameCity(p.name,name)&&Array.isArray(c)&&c.every(Number.isFinite);}
function bounds(f){const [lon,lat]=f.geometry.coordinates,e=f.properties?.extent;return Array.isArray(e)&&e.length===4&&e.every(Number.isFinite)?[e[0],e[3],e[2],e[1]]:[lon-.09,lat-.07,lon+.09,lat+.07];}
async function searchActivityVenues({q,city},{fetchImpl=fetch,enrich=true}={}){
 if(typeof q!=='string'||q.trim().length<3||q.length>160||/[\x00-\x1f]/.test(q)||city!=null&&(typeof city!=='string'||city.length>100||/[\x00-\x1f]/.test(city)))throw Object.assign(Error('Saisissez une recherche entre 3 et 160 caractères et une ville valide.'),{status:400});
 if(inFlight>=3)throw Object.assign(Error('Recherche occupée. Réessayez dans quelques instants.'),{status:429});
 inFlight++;try{
 const parsed=intent(q.trim(),city);let center=null,cityOnly=false,partial=false,success=false,features=[];
 // Resolve a municipality separately: a city is a search area, never a venue card.
 try{const candidates=await photon({q:parsed.city||q.trim(),layer:'city',limit:'3'},fetchImpl);success=true;center=candidates.find(f=>cityFeature(f,parsed.city||q.trim()));if(!parsed.city&&center&&!parsed.type){parsed.city=center.properties.name;parsed.term='';cityOnly=true;}}catch{partial=true;}
 const box=center?bounds(center):null,geo=box?{bbox:box.join(','),lat:String(center.geometry.coordinates[1]),lon:String(center.geometry.coordinates[0])}:{};
 try{features=await photon({q:cityOnly?parsed.city:[parsed.term,parsed.city].filter(Boolean).join(' '),...geo},fetchImpl);success=true;}catch{partial=true;}
 if(enrich&&parsed.type==='patinoire')try{features.push(...await photon({q:'glace '+parsed.city,...geo},fetchImpl));success=true;}catch{partial=true;}
 const unique=new Map(),accept=v=>{if(!v)return false;if(parsed.city&&v.city&&!sameCity(v.city,parsed.city))return false;if(parsed.city&&!v.city&&(!box||v.lon<box[0]||v.lon>box[2]||v.lat<box[1]||v.lat>box[3]))return false;
 if(parsed.type==='patinoire'&&!/^(ice_rink|ice_skating|ice_hockey)$/.test(v.category)&&!(v.category==='sports_centre'&&/glace|patinoire/i.test(v.name)))return false;
 if(parsed.type==='bowling'&&v.category!=='bowling_alley'&&!/bowling/i.test(v.name))return false;
 return true;};
 const add=v=>{if(cityOnly&&!/^(sports_centre|ice_rink|bowling_alley|park|garden|playground|swimming_pool|pitch|restaurant|cafe|bar|pub|cinema|theatre|museum|attraction|zoo|theme_park|gallery|community_centre)$/.test(v?.category||''))return;if(accept(v)&&!unique.has(v.id))unique.set(v.id,v);};features.map(normalizeVenue).forEach(add);
 // Reuse the existing OSM provider for city discovery and a failed/empty text search.
 if(enrich&&center&&(cityOnly||!unique.size))try{const {nearbyVenues}=require('./activity-venue-details');const found=await nearbyVenues(box,parsed.type,{fetchImpl});found.forEach(add);success=true;}catch{partial=true;}
 // The configured Geoapify restaurant adapter remains scoped to restaurant searches.
 if(enrich&&center&&!unique.size&&parsed.type==='restaurant'&&process.env.GEOAPIFY_API_KEY)try{const {searchRestaurants}=require('./geoapify-restaurants');const data=await searchRestaurants({lat:center.geometry.coordinates[1],lon:center.geometry.coordinates[0],radius:5},{fetchImpl});data.results.forEach(v=>add({...v,category:'restaurant',city:v.city,source:'Geoapify / OpenStreetMap',source_url:'https://www.geoapify.com/',retrieved_at:new Date().toISOString(),booking_url:null}));success=true;}catch{partial=true;}
 if(!success)throw Error('providers');
 const {officialReference}=require('./venue-official-references');
 const results=[...unique.values()].map(officialReference).sort((a,b)=>Number(Boolean(b.website_reference))-Number(Boolean(a.website_reference))||a.name.localeCompare(b.name,'fr')).slice(0,30);
 return {results,source:'OpenStreetMap / Photon',attribution_url:'https://www.openstreetmap.org/copyright',partial,city:parsed.city||null,notice:partial?'Une source est indisponible. Résultats disponibles uniquement, sans élargissement silencieux de la ville.':'Informations déclarées par les sources : horaires et tarifs à confirmer. Aucune disponibilité garantie.'};
 }catch{throw Object.assign(Error('La recherche de lieux est temporairement indisponible. Vous pouvez saisir le lieu manuellement.'),{status:503});}finally{inFlight--;}
}
module.exports={searchActivityVenues,normalizeVenue,safeUrl,intent};
