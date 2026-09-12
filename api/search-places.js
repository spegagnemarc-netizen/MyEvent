const PHOTON_ENDPOINTS = [
  'https://photon.komoot.io/reverse'
];

function send(res, status, body) {
  res.status(status);
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeFeature(feature, index) {
  const p = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const extra = p.extra && typeof p.extra === 'object' ? p.extra : {};
  const osmKey = p.osm_key || '';
  const osmValue = p.osm_value || '';

  const type = osmValue || osmKey || 'attraction';

  const address = [
    p.housenumber,
    p.street,
    p.postcode,
    p.city || p.locality,
  ].filter(Boolean).join(' ');

  const capacity =
    toNumber(extra.capacity) ??
    toNumber(p.capacity);

  const price =
    toNumber(extra.price) ??
    toNumber(p.price);

  const equipment = [
    extra.wheelchair === 'yes' || p.wheelchair === 'yes' ? '♿ Accessibilité' : '',
    extra.parking ? '🅿️ Parking' : '',
    extra.internet_access ? '📶 Wi-Fi' : '',
  ].filter(Boolean).join(' · ');

  return {
    id: 'photon-' + (p.osm_type || 'item') + '-' + (p.osm_id || index),
    name: p.name || p.street || '',
    address: address || p.district || p.county || '',
    lat,
    lon,
    type,
    typeLabel: type.replaceAll('_', ' '),
    capacity,
    price,
    equipment,
    website: extra.website || p.website || '',
    phone: extra.phone || p.phone || '',
    source: 'OpenStreetMap / Photon',
  };
}

const MODE_FILTERS = {
  nearby: [
    'osm.amenity.restaurant',
    'osm.amenity.cafe',
    'osm.amenity.fast_food',
    'osm.amenity.bar',
    'osm.amenity.pub',
    'osm.amenity.cinema',
    'osm.amenity.theatre',
    'osm.amenity.museum',
    'osm.amenity.arts_centre',
    'osm.amenity.bowling_alley',
    'osm.amenity.fitness_centre',
    'osm.amenity.sports_centre',
    'osm.tourism.attraction',
    'osm.tourism.museum',
    'osm.tourism.gallery',
    'osm.tourism.viewpoint',
    'osm.leisure.park',
    'osm.leisure.playground',
    'osm.leisure.sports_centre',
    'osm.leisure.fitness_centre',
    'osm.leisure.bowling_alley',
    'osm.leisure.water_park',
  ],
  hall: [
    'osm.amenity.community_centre',
    'osm.amenity.social_centre',
    'osm.amenity.conference_centre',
    'osm.amenity.events_venue',
    'osm.leisure.sports_hall',
    'osm.leisure.sports_centre',
    'osm.tourism.hotel',
    'osm.tourism.guest_house',
  ],
};

function buildPhotonUrl(mode, lat, lon, radius, limit) {
  const url = new URL(PHOTON_ENDPOINTS[0]);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('dedupe', '1');
  url.searchParams.set('include', MODE_FILTERS[mode].join(','));
  return url.toString();
}

async function fetchPhoton(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MyEvent/51.3 (nearby and venue search; my-event-eosin.vercel.app)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Photon HTTP ' + response.status);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.features)) {
      throw new Error('Réponse Photon invalide');
    }

    return data;
  } finally {
    clearTimeout(timer);
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
  const radius = number(req.query.radius) ?? (mode === 'hall' ? 5 : 3);
  const minCapacity = number(req.query.minCapacity);
  const maxBudget = number(req.query.maxBudget);

  if (!Object.prototype.hasOwnProperty.call(MODE_FILTERS, mode)) {
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

  const url = buildPhotonUrl(
    mode,
    lat,
    lon,
    radius,
    mode === 'hall' ? 120 : 160
  );

  let data;

  try {
    data = await fetchPhoton(url);
  } catch (error) {
    console.error(
      '[MyEvent V51.3] Photon failure:',
      error?.message || error
    );

    return send(res, 503, {
      error:
        'Le service OpenStreetMap est temporairement indisponible.',
      detail:
        error?.message || 'Photon indisponible'
    });
  }

  const seen = new Set();
  const results = [];

  for (let i = 0; i < data.features.length; i += 1) {
    const item = normalizeFeature(
      data.features[i],
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

    if (item.distance > radius) continue;

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
      'OpenStreetMap / Photon via MyEvent API'
  });
};
