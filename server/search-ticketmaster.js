// Discovery only. Never return provider payloads, request URLs or credentials.
const cache = new Map();
let starts = [];
const text = value => typeof value === 'string' ? value.slice(0, 300) : '';
function eventUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/(^|\.)ticketmaster\.(fr|com)$/.test(url.hostname)) return '';
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return ''; }
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Méthode non autorisée.'});
  }
  const query = req.query || {};
  for (const key of ['q', 'city']) {
    if (query[key] !== undefined && (typeof query[key] !== 'string' || query[key].length > 100)) {
      return res.status(400).json({error:'Recherche invalide (100 caractères maximum).'});
    }
  }
  const q = (query.q || '').trim(), city = (query.city || '').trim();
  const key = (process.env.TICKETMASTER_API_KEY || '').trim();
  if (!key) return res.status(503).json({error:'La recherche Ticketmaster est temporairement indisponible. Le partenaire ci-dessous reste accessible.'});
  const cacheKey = JSON.stringify([q, city]);
  const now = Date.now();
  for (const [id, entry] of cache) if (entry.until <= now) cache.delete(id);
  let entry = cache.get(cacheKey);
  if (!entry) {
    starts = starts.filter(t => t > now - 1000);
    if (starts.length >= 4) {
      res.setHeader('Retry-After', '1');
      return res.status(429).json({error:'Trop de recherches. Réessaie dans quelques instants.'});
    }
    starts.push(now);
    const params = new URLSearchParams({apikey:key, countryCode:'FR', locale:'fr', size:'20', sort:'date,asc', startDateTime:new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), includeTest:'no'});
    if (q) params.set('keyword', q);
    if (city) params.set('city', city);
    entry = {until:now + 300000, promise:(async()=>{
      const response = await fetch('https://app.ticketmaster.com/discovery/v2/events.json?' + params, {signal:AbortSignal.timeout(10000), redirect:'error'});
      if (!response.ok) throw new Error('Provider unavailable');
      const data = await response.json();
      const results = (Array.isArray(data?._embedded?.events) ? data._embedded.events : []).slice(0,20).map(event=>{
        const venue = event._embedded?.venues?.[0];
        return {id:text(event.id),name:text(event.name),date:text(event.dates?.start?.localDate),time:text(event.dates?.start?.localTime),venue:text(venue?.name),city:text(venue?.city?.name),url:eventUrl(event.url)};
      }).filter(event=>event.name && event.url);
      return {provider:'Ticketmaster',countryCode:'FR',results};
    })()};
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, entry);
  }
  try {
    const body = await entry.promise;
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.status(200).json(body);
  } catch {
    cache.delete(cacheKey);
    return res.status(502).json({error:'Ticketmaster ne répond pas pour le moment. Réessaie plus tard ou utilise le partenaire ci-dessous.'});
  }
};
