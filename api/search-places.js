const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

function send(res, status, body) {
  res.status(status);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.json(body);
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function normalizePlace(x, index) {
  const t = x.tags || {};
  const lat = x.lat ?? x.center?.lat;
  const lon = x.lon ?? x.center?.lon;

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return null;
  }

  return {
    id: 'osm-' + (x.type || 'item') + '-' + (x.id || index),
    name: t.name || '',
    address: [
      t['addr:housenumber'],
      t['addr:street'],
      t['addr:postcode'],
      t['addr:city']
    ].filter(Boolean).join(' ') || t['addr:place'] || '',
    lat: Number(lat),
    lon: Number(lon),
    type: t.amenity || t.tourism || t.leisure || 'attraction',
    typeLabel: t.amenity || t.tourism || t.leisure || 'lieu événementiel',
    capacity: number(t.capacity),
    price: number(t.price != null ? String(t.price).replace(',', '.') : null),
    equipment: [
      t.wheelchair ? '♿ Accessibilité' : '',
      t.parking ? '🅿️ Parking' : '',
      t.internet_access ? '📶 Wi-Fi' : ''
    ].filter(Boolean).join(' · '),
    website: t.website || t['contact:website'] || '',
    phone: t.phone || t['contact:phone'] || '',
    source: 'OpenStreetMap'
  };
}

function buildQuery(mode, lat, lon, radius) {
  const around = radius * 1000;

  if (mode === 'hall') {
    return `[out:json][timeout:12];(
      nwr(around:${around},${lat},${lon})[amenity~"community_centre|social_centre|conference_centre|events_venue"];
      nwr(around:${around},${lat},${lon})[leisure~"sports_hall|sports_centre"];
      nwr(around:${around},${lat},${lon})[tourism~"hotel|guest_house"];
    );out center tags;`;
  }

  return `[out:json][timeout:12];(
    nwr(around:${around},${lat},${lon})[amenity~"restaurant|cafe|bar|fast_food|pub|cinema|theatre|museum|arts_centre|bowling_alley|fitness_centre|sports_centre"];
    nwr(around:${around},${lat},${lon})[tourism~"attraction|museum|gallery|viewpoint"];
    nwr(around:${around},${lat},${lon})[leisure~"park|playground|sports_centre|fitness_centre|bowling_alley|water_park"];
  );out center tags;`;
}

async function fetchOverpass(endpoint, query, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json',
        'User-Agent': 'MyEvent/51.2 (OSM venue/place search; my-event-eosin.vercel.app)'
      },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error('Overpass HTTP ' + response.status);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.elements)) {
      throw new Error('Réponse Overpass invalide');
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function queryOverpass(query) {
  try {
    return await Promise.any(
      OVERPASS_ENDPOINTS.map(endpoint =>
        fetchOverpass(endpoint, query, 4500)
      )
    );
  } catch (error) {
    const reasons = Array.isArray(error?.errors)
      ? error.errors.map(e => e?.message || String(e)).join(' | ')
      : error?.message || 'Overpass indisponible';

    throw new Error(reasons);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, {
      error: 'Méthode non autorisée.'
    });
  }

  const mode = String(req.query.mode || 'nearby').toLowerCase();
  const lat = number(req.query.lat);
  const lon = number(req.query.lon);
  const radius =
    number(req.query.radius) ?? (mode === 'hall' ? 5 : 3);
  const minCapacity = number(req.query.minCapacity);
  const maxBudget = number(req.query.maxBudget);

  if (!['nearby', 'hall'].includes(mode)) {
    return send(res, 400, {
      error: 'Mode de recherche invalide.'
    });
  }

  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return send(res, 400, {
      error: 'Coordonnées invalides.'
    });
  }

  if (
    mode === 'hall' &&
    ![3, 5, 10, 20].includes(radius)
  ) {
    return send(res, 400, {
      error: 'Rayon invalide.'
    });
  }

  if (
    mode === 'nearby' &&
    (radius < 1 || radius > 10)
  ) {
    return send(res, 400, {
      error: 'Rayon de proximité invalide.'
    });
  }

  const query = buildQuery(mode, lat, lon, radius);
  let data;

  try {
    data = await queryOverpass(query);
  } catch (error) {
    console.error(
      '[MyEvent V51.2] Overpass failure:',
      error?.message || error
    );

    return send(res, 503, {
      error:
        'Le service OpenStreetMap est temporairement indisponible.',
      detail:
        error?.message || 'Overpass indisponible'
    });
  }

  const seen = new Set();
  const results = [];

  for (let i = 0; i < data.elements.length; i += 1) {
    const item = normalizePlace(
      data.elements[i],
      i
    );

    if (!item || !item.name) continue;

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
      mode === 'hall' &&
      minCapacity !== null &&
      minCapacity > 0 &&
      item.capacity !== null &&
      item.capacity < minCapacity
    ) {
      continue;
    }

    if (
      mode === 'hall' &&
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
    (a, b) => a.distance - b.distance
  );

  return send(res, 200, {
    mode,
    results:
      results.slice(
        0,
        mode === 'hall' ? 80 : 100
      ),
    count: results.length,
    radius,
    minCapacity:
      mode === 'hall'
        ? (minCapacity || null)
        : null,
    maxBudget:
      mode === 'hall'
        ? (maxBudget || null)
        : null,
    source:
      'OpenStreetMap / Overpass via MyEvent API'
  });
};
