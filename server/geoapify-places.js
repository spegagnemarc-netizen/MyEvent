// Server-side only. Never return provider payloads or credential-bearing URLs.
const FOOD = 'catering.restaurant,catering.fast_food';
const ACTIVITIES = 'entertainment';
const OUTDOORS = 'leisure.park,leisure.spa,sport';
const HALLS = 'activity.events_venue,activity.community_center';

async function places(lat, lon, radius, categories, limit = 100) {
  const url = new URL('https://api.geoapify.com/v2/places');
  url.search = new URLSearchParams({
    apiKey: process.env.GEOAPIFY_API_KEY, categories,
    filter: `circle:${lon},${lat},${Math.round(radius * 1000)}`,
    bias: `proximity:${lon},${lat}`, limit: String(limit), lang: 'fr'
  }).toString();
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch (_) {
    throw Object.assign(new Error('Geoapify indisponible.'), { code: 'PROVIDER_UNAVAILABLE' });
  }
  if (!response.ok) {
    const status = response.status;
    throw Object.assign(new Error('Geoapify HTTP ' + status), {
      providerStatus: status,
      code: [401, 403].includes(status) ? 'PROVIDER_AUTH' : status === 429 ? 'PROVIDER_QUOTA' : 'PROVIDER_UNAVAILABLE'
    });
  }
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.features)) {
    throw Object.assign(new Error('Réponse Geoapify invalide.'), { code: 'PROVIDER_UNAVAILABLE' });
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
  const reason = code === 'PROVIDER_AUTH' ? 'Son accès doit être vérifié.' :
    code === 'PROVIDER_QUOTA' ? 'Sa limite de requêtes est atteinte ; réessaie plus tard.' : 'Réessaie dans quelques instants.';
  return {
    error: `Le fournisseur de recherche ${subject} est temporairement indisponible. ${reason}`,
    code, ...(error?.providerStatus ? { providerStatus: error.providerStatus } : {})
  };
}

module.exports = { places, feature, failure, FOOD, ACTIVITIES, OUTDOORS, HALLS };
