// Server-side only. Never return provider payloads or credential-bearing URLs.
const FOOD = 'catering.restaurant,catering.fast_food';
const ACTIVITIES = 'entertainment';
const OUTDOORS = 'leisure.park,leisure.spa,sport';
const HALLS = 'activity.events_venue,activity.community_center';

// Search-only override; halls retain their existing 10-second default.
function searchTimeoutMs() {
  const value = Number(process.env.GEOAPIFY_SEARCH_TIMEOUT_MS);
  return Number.isInteger(value) && value >= 1000 && value <= 20000 ? value : 10000;
}
function transportFailure(error, signal, phase) {
  const timeout = signal.aborted || ['TimeoutError', 'AbortError'].includes(error?.name);
  return Object.assign(new Error('Échec de recherche Geoapify.'), {
    code: timeout ? 'PROVIDER_TIMEOUT' : phase === 'json' ? 'PROVIDER_RESPONSE' : 'PROVIDER_NETWORK'
  });
}
async function places(lat, lon, radius, categories, limit = 100, timeoutMs = 10000) {
  const url = new URL('https://api.geoapify.com/v2/places');
  url.search = new URLSearchParams({
    apiKey: process.env.GEOAPIFY_API_KEY, categories,
    filter: `circle:${lon},${lat},${Math.round(radius * 1000)}`,
    bias: `proximity:${lon},${lat}`, limit: String(limit), lang: 'fr'
  }).toString();
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) { throw transportFailure(error, signal, 'fetch'); }
  if (!response.ok) {
    const status = response.status;
    throw Object.assign(new Error('Geoapify HTTP ' + status), {
      providerStatus: status,
      code: [401, 403].includes(status) ? 'PROVIDER_AUTH' : status === 429 ? 'PROVIDER_QUOTA' : 'PROVIDER_HTTP'
    });
  }
  let data;
  try { data = await response.json(); }
  catch (error) { throw transportFailure(error, signal, 'json'); }
  if (!Array.isArray(data?.features)) {
    throw Object.assign(new Error('Réponse Geoapify invalide.'), { code: 'PROVIDER_RESPONSE' });
  }
  return data.features.filter(f => f.properties?.name || f.properties?.['name:fr']);
}

function feature(feature) {
  const p = feature.properties || {}, raw = p.datasource?.raw || {}, categories = p.categories || [];
  const food = categories.some(c => c === 'catering.restaurant' || c.startsWith('catering.restaurant.'));
  const fastFood = categories.some(c => c === 'catering.fast_food' || c.startsWith('catering.fast_food.'));
  // Prefer provider categories for food: generic OSM tags must not hide a restaurant.
  const kind = food ? 'restaurant' : fastFood ? 'fast_food' : raw.amenity || raw.leisure || raw.tourism ||
    (categories.find(c => c.includes('.')) || 'activity').split('.').at(-1);
  return { geometry: feature.geometry, properties: {
    ...p, name: p.name || p['name:fr'], source: 'OpenStreetMap / Geoapify',
    osm_id: p.place_id, osm_key: raw.amenity ? 'amenity' : raw.leisure ? 'leisure' : 'tourism',
    osm_value: kind, extra: raw
  }};
}

function failure(error, subject = 'de lieux') {
  const code = error?.code || 'PROVIDER_UNAVAILABLE';
  const reason = ({
    PROVIDER_AUTH: 'Son accès doit être vérifié.',
    PROVIDER_QUOTA: 'Sa limite de requêtes est atteinte ; réessaie plus tard.',
    PROVIDER_TIMEOUT: 'Le délai de réponse est dépassé.',
    PROVIDER_NETWORK: 'La connexion au fournisseur a échoué.',
    PROVIDER_HTTP: 'Le fournisseur a renvoyé une erreur.',
    PROVIDER_RESPONSE: 'Le fournisseur a renvoyé une réponse invalide.'
  })[code] || 'Réessaie dans quelques instants.';
  return {
    error: `Le fournisseur de recherche ${subject} est temporairement indisponible. ${reason}`,
    code, ...(error?.providerStatus ? { providerStatus: error.providerStatus } : {})
  };
}

// Public place responses only. Never cache a key, an account or a user's planning data.
const searchCache=new Map(),searchPending=new Map();
async function searchPlaces(lat,lon,radius,categories){
  const key=JSON.stringify([lat,lon,radius,categories]),now=Date.now(),cached=searchCache.get(key);
  if(cached&&now-cached.at<60000)return {features:cached.features,cached:true,stale:false,durationMs:0};
  if(searchPending.has(key))return searchPending.get(key);
  const request=(async()=>{
    const start=Date.now();
    try{
      const features=await places(lat,lon,radius,categories,100,searchTimeoutMs());
      searchCache.set(key,{at:Date.now(),features});
      while(searchCache.size>100)searchCache.delete(searchCache.keys().next().value);
      return {features,cached:false,stale:false,durationMs:Date.now()-start};
    }catch(error){
      if(cached&&Date.now()-cached.at<600000)return {features:cached.features,cached:true,stale:true,durationMs:Date.now()-start,failure:failure(error)};
      throw Object.assign(error,{durationMs:Date.now()-start});
    }
  })();
  searchPending.set(key,request);
  try{return await request;}finally{if(searchPending.get(key)===request)searchPending.delete(key);}
}

module.exports = { places, searchPlaces, feature, failure, searchTimeoutMs, FOOD, ACTIVITIES, OUTDOORS, HALLS };
