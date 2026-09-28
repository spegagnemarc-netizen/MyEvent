const VIATOR_ACCEPT = 'application/json;version=2.0';
let destinationCache = { expiresAt: 0, items: [] };

function send(res, status, body) {
  res.status(status);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  return res.json(body);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const q = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

function bestImage(images) {
  const variants = (Array.isArray(images) ? images : [])
    .flatMap(image => Array.isArray(image?.variants) ? image.variants : [])
    .filter(v => v?.url);
  variants.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));
  return variants.find(v => Number(v.width) <= 720)?.url || variants[0]?.url || '';
}

function reviewSummary(reviews) {
  const sources = Array.isArray(reviews?.sources) ? reviews.sources : [];
  const total = num(reviews?.totalReviews) ?? sources.reduce((sum, x) => sum + (num(x?.totalCount) || 0), 0);
  const rating = num(reviews?.combinedAverageRating) ??
    num(sources.find(x => String(x?.provider || '').toUpperCase() === 'VIATOR')?.averageRating) ??
    num(sources[0]?.averageRating);
  return { rating, reviewCount: total };
}

async function viatorFetch(base, path, key, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(base + path, {
      ...options,
      headers: {
        Accept: VIATOR_ACCEPT,
        'Accept-Language': 'fr-FR',
        'Content-Type': 'application/json',
        'exp-api-key': key,
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const err = new Error(data?.message || data?.error || ('Viator HTTP ' + response.status));
      err.status = response.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getDestinations(base, key) {
  if (destinationCache.expiresAt > Date.now() && destinationCache.items.length) {
    return destinationCache.items;
  }
  const data = await viatorFetch(base, '/v1/taxonomy/destinations', key, { method: 'GET' });
  const items = Array.isArray(data?.destinations) ? data.destinations : (Array.isArray(data) ? data : []);
  destinationCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, items };
  return items;
}

function nearestDestination(destinations, lat, lon) {
  const ranked = destinations
    .map(d => {
      const dLat = num(d?.center?.latitude);
      const dLon = num(d?.center?.longitude);
      if (dLat === null || dLon === null || d?.destinationId == null) return null;
      return { ...d, _distance: haversineKm(lat, lon, dLat, dLon) };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const preferred = type => ['CITY', 'TOWN', 'VILLAGE', 'AREA', 'DISTRICT'].includes(String(type || '').toUpperCase()) ? 0 : 1;
      const da = preferred(a.type), db = preferred(b.type);
      if (Math.abs(a._distance - b._distance) < 25 && da !== db) return da - db;
      return a._distance - b._distance;
    });
  return ranked[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Méthode non autorisée.' });
  }

  const key = process.env.VIATOR_API_KEY_SANDBOX || process.env.VIATOR_API_KEY;
  if (!key) return send(res, 503, { error: 'Viator n’est pas encore configuré sur le serveur.' });

  const lat = num(req.query.lat);
  const lon = num(req.query.lon);
  const count = Math.min(50, Math.max(1, Math.round(num(req.query.count) || 30)));
  const maxPrice = num(req.query.maxPrice);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return send(res, 400, { error: 'Coordonnées invalides.' });
  }

  // Sandbox is the safe default. Set VIATOR_API_ENV=production only when the
  // production key is active and the integration is ready to go live.
  const production = String(process.env.VIATOR_API_ENV || '').toLowerCase() === 'production';
  const base = production ? 'https://api.viator.com/partner' : 'https://api.sandbox.viator.com/partner';

  try {
    const destinations = await getDestinations(base, key);
    const destination = nearestDestination(destinations, lat, lon);
    if (!destination) return send(res, 200, { results: [], count: 0, source: 'Viator', destination: null });

    const filtering = { destination: String(destination.destinationId) };
    if (maxPrice !== null && maxPrice > 0) filtering.highestPrice = maxPrice;

    const data = await viatorFetch(base, '/products/search', key, {
      method: 'POST',
      body: JSON.stringify({
        filtering,
        sorting: { sort: 'DEFAULT', order: 'ASCENDING' },
        pagination: { start: 1, count },
        currency: 'EUR'
      })
    });

    const centerLat = num(destination?.center?.latitude);
    const centerLon = num(destination?.center?.longitude);
    const products = Array.isArray(data?.products) ? data.products : [];
    const results = products.map(product => {
      const reviews = reviewSummary(product?.reviews);
      const price = num(product?.pricing?.summary?.fromPrice) ?? num(product?.pricing?.fromPrice);
      return {
        id: 'viator-' + String(product?.productCode || ''),
        productCode: product?.productCode || '',
        name: product?.title || 'Activité Viator',
        description: product?.description || '',
        type: 'viator_activity',
        typeLabel: 'Activité réservable',
        address: destination?.name || '',
        lat: centerLat,
        lon: centerLon,
        distance: centerLat !== null && centerLon !== null ? haversineKm(lat, lon, centerLat, centerLon) : null,
        price,
        currency: product?.pricing?.currency || product?.pricing?.summary?.currency || 'EUR',
        image: bestImage(product?.images),
        rating: reviews.rating,
        reviewCount: reviews.reviewCount,
        website: product?.productUrl || '',
        flags: Array.isArray(product?.flags) ? product.flags : [],
        tags: Array.isArray(product?.tags) ? product.tags : [],
        source: 'viator'
      };
    }).filter(x => x.productCode && x.name && x.website);

    return send(res, 200, {
      results,
      count: results.length,
      totalCount: num(data?.totalCount),
      destination: {
        id: destination.destinationId,
        name: destination.name,
        type: destination.type,
        distanceKm: Number(destination._distance.toFixed(1))
      },
      environment: production ? 'production' : 'sandbox',
      source: 'Viator Affiliate API'
    });
  } catch (error) {
    console.error('[MyEvent Viator]', error?.message || error);
    const status = [401, 403, 429].includes(error?.status) ? error.status : 502;
    return send(res, status, { error: error?.message || 'Viator est temporairement indisponible.' });
  }
};
