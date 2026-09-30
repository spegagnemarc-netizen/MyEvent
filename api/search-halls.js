const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.json(body);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeElement(x, index) {
  const t = x.tags || {};
  const itemLat = x.lat ?? x.center?.lat;
  const itemLon = x.lon ?? x.center?.lon;

  if (!Number.isFinite(Number(itemLat)) || !Number.isFinite(Number(itemLon))) {
    return null;
  }

  const capRaw = t.capacity != null
    ? String(t.capacity).replace(/[^0-9.]/g, '')
    : '';

  const priceRaw = t.price != null
    ? String(t.price).replace(',', '.').replace(/[^0-9.]/g, '')
    : '';

  const capacity = capRaw ? Number(capRaw) : null;
  const price = priceRaw ? Number(priceRaw) : null;

  const equipment = [
    t.cuisine ? '🍽️ ' + t.cuisine : '',
    t.wheelchair ? '♿ Accessibilité' : '',
    t.parking ? '🅿️ Parking' : '',
    t.internet_access ? '📶 Wi-Fi' : ''
  ].filter(Boolean).join(' · ');

  return {
    id: 'osm-' + (x.id || index),
    name: t.name || 'Lieu événementiel',

    address: [
      t['addr:housenumber'],
      t['addr:street'],
      t['addr:postcode'],
      t['addr:city']
    ].filter(Boolean).join(' ') || t['addr:place'] || '',

    lat: Number(itemLat),
    lon: Number(itemLon),

    capacity: Number.isFinite(capacity) ? capacity : null,
    price: Number.isFinite(price) ? price : null,

    equipment,

    typeLabel:
      t.amenity ||
      t.leisure ||
      t.tourism ||
      'lieu événementiel',

    website:
      t.website ||
      t['contact:website'] ||
      '',

    phone:
      t.phone ||
      t['contact:phone'] ||
      '',

    source: 'OpenStreetMap'
  };
}

function isRelevantRentalVenue(item) {
  const name=String(item?.name||'').toLowerCase();
  const type=String(item?.typeLabel||'').toLowerCase();
  const strongName=/(salle des f[eê]tes|salle de r[eé]ception|espace [eé]v[eé]nementiel|centre de conf[eé]rence|conference|s[eé]minaire|seminaire|wedding|reception|domaine)/i.test(name);
  const strongType=/(events_venue|conference_centre)/i.test(type);
  const hallName=/(salle|hall|foyer|maison des associations|centre culturel)/i.test(name);
  const community=/(community_centre|village_hall|community_hall)/i.test(type);
  const excluded=/(gymnase|gymnasium|stade|stadium|piscine|swimming|tennis|fitness|dojo|sport|school|école|ecole|mairie|townhall|hôtel de ville|hotel de ville|parking|église|eglise|church|hospital)/i.test(name+' '+type);
  return !excluded && (strongName || strongType || (community && hallName));
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const rad = Math.PI / 180;

  const x = (bLat - aLat) * rad;
  const y = (bLon - aLon) * rad;

  const q =
    Math.sin(x / 2) ** 2 +
    Math.cos(aLat * rad) *
    Math.cos(bLat * rad) *
    Math.sin(y / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(q));
}

async function fetchOverpass(endpoint, query, timeoutMs = 9500) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(endpoint + '?data=' + encodeURIComponent(query), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MyEvent/51.1 (venue search; contact via my-event-eosin.vercel.app)'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        'Overpass HTTP ' + response.status
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.elements)) {
      throw new Error(
        'Réponse Overpass invalide'
      );
    }

    return data;

  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {

  if (req.method !== 'GET') {

    res.setHeader(
      'Allow',
      'GET'
    );

    return json(
      res,
      405,
      {
        error: 'Méthode non autorisée'
      }
    );
  }

  const lat = num(req.query.lat);
  const lon = num(req.query.lon);

  const radius =
    num(req.query.radius) ?? 5;

  const minCapacity =
    num(req.query.minCapacity);

  const maxBudget =
    num(req.query.maxBudget);

  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {

    return json(
      res,
      400,
      {
        error: 'Coordonnées invalides.'
      }
    );
  }

  if (![3, 5, 10, 20].includes(radius)) {

    return json(
      res,
      400,
      {
        error: 'Rayon invalide.'
      }
    );
  }

  // V1: keep this search deliberately narrow. Generic public buildings,
  // hotels and sports facilities produced many false positives.
  // Keep the provider query broad and cheap, then apply our stricter
  // rental-venue filter in JavaScript. Complex regex filters in Overpass
  // proved unreliable across public mirrors/serverless requests.
  const query = `[out:json][timeout:15];(
    nwr(around:${radius * 1000},${lat},${lon})[amenity="events_venue"];
    nwr(around:${radius * 1000},${lat},${lon})[amenity="conference_centre"];
    nwr(around:${radius * 1000},${lat},${lon})[amenity="community_centre"];
  );out center tags;`;

  let data = null;
  let lastError = null;

  try {

    // Race several independent public mirrors. One slow/busy Overpass
    // instance must not make the whole MyEvent venue search unavailable.
    data = await Promise.any(
      OVERPASS_ENDPOINTS.map(
        endpoint =>
          fetchOverpass(
            endpoint,
            query
          )
      )
    );

  } catch (error) {

    lastError = error;
  }

  if (!data) {

    return json(
      res,
      503,
      {
        error:
          'Le service de recherche de salles est temporairement indisponible.',

        detail:
          lastError?.message ||
          'Overpass indisponible'
      }
    );
  }

  const seen = new Set();
  const results = [];

  for (
    let i = 0;
    i < data.elements.length;
    i += 1
  ) {

    const item =
      normalizeElement(
        data.elements[i],
        i
      );

    if (!item || !isRelevantRentalVenue(item)) continue;

    const key =
      `${item.name}|${item.lat.toFixed(5)}|${item.lon.toFixed(5)}`
        .toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);

    item.distance =
      distanceKm(
        lat,
        lon,
        item.lat,
        item.lon
      );

    if (
      minCapacity !== null &&
      minCapacity > 0 &&
      item.capacity !== null &&
      item.capacity < minCapacity
    ) {
      continue;
    }

    if (
      maxBudget !== null &&
      maxBudget > 0 &&
      item.price !== null &&
      item.price > maxBudget
    ) {
      continue;
    }

    results.push(item);
  }

  results.sort(
    (a, b) =>
      a.distance - b.distance
  );

  return json(
    res,
    200,
    {
      results:
        results.slice(0, 80),

      count:
        results.length,

      radius,

      minCapacity:
        minCapacity || null,

      maxBudget:
        maxBudget || null,

      source:
        'OpenStreetMap / Overpass'
    }
  );
};
