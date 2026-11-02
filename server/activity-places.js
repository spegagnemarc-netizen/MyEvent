// Read-only OSM discovery, sharing the national geocoder, cache and provider budget.
const {distanceKm,deduplicate}=require('../lib/geoapify-restaurants');
function safeUrl(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const categories={
 bowling:['[leisure=bowling_alley]','[sport="10pin"]'],
 bars:['[amenity~"^(bar|pub|biergarten)$"]'],
 games:['[club=board_games]','[leisure=amusement_arcade]','[board_games=yes]'],
 music:['[amenity=music_venue]','[leisure=dance]'],
 culture:['[amenity~"^(theatre|cinema|arts_centre)$"]','[tourism~"^(museum|gallery)$"]'],
 leisure:['[leisure~"^(sports_centre|escape_game|water_park|miniature_golf)$"]'],
 meeting:['[amenity~"^(cafe|community_centre|social_centre)$"]'],
 restaurant:['[amenity=restaurant]']
};
function normalize(elements,{lat,lon,radius},checked){
 const rows=[];let excluded=0;
 for(const e of elements){const t=e.tags||{},a=e.lat??e.center?.lat,o=e.lon??e.center?.lon;
  if(!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||!t.name||!Number.isFinite(a)||!Number.isFinite(o)||Math.abs(a)>90||Math.abs(o)>180||distanceKm(lat,lon,a,o)>radius){excluded++;continue;}
  rows.push({id:`osm-${e.type}-${e.id}`,name:String(t.name).slice(0,200),lat:a,lon:o,city:t['addr:city']||null,address:[t['addr:housenumber'],t['addr:street'],t['addr:postcode'],t['addr:city']].filter(Boolean).join(' ')||null,website:safeUrl(t.website||t['contact:website']),phone:t.phone||t['contact:phone']||null,opening_hours:t.opening_hours||null,source:'openstreetmap',source_url:`https://www.openstreetmap.org/${e.type}/${e.id}`,checked_at:checked,sources:[{name:'© contributeurs OpenStreetMap · ODbL-1.0',url:`https://www.openstreetmap.org/${e.type}/${e.id}`}],description:'Lieu référencé dans OpenStreetMap. Aucun événement daté, tarif ni disponibilité confirmé.'});
 }
 return {places:deduplicate(rows),excluded};
}
function query(category,lat,lon,radius){if(!Object.hasOwn(categories,category))throw Object.assign(Error('Catégorie invalide.'),{status:400});return '[out:json][timeout:20][maxsize:16777216];('+categories[category].map(s=>`nwr(around:${radius*1000},${lat.toFixed(4)},${lon.toFixed(4)})${s};`).join('')+');out center 200;';}
module.exports={categories,normalize,query};
