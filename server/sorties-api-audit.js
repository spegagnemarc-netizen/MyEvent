'use strict';

const { createHash, timingSafeEqual } = require('node:crypto');
const { feature: existingGeoFeature } = require('./geoapify-places');

const SCENARIO = 'gap-lyon-v1';
const MAX_CALLS = 22;
const DEADLINE_MS = 190000;
const REQUEST_MS = 7000;
const MAX_BYTES = 1024 * 1024;
const CITIES = Object.freeze([
  Object.freeze({ name: 'Gap', lat: 44.5596, lon: 6.0797, radius: 5000 }),
  Object.freeze({ name: 'Lyon', lat: 45.7640, lon: 4.8357, radius: 5000 })
]);
const CATEGORIES = Object.freeze([
  Object.freeze({ name: 'restaurant', query: ['catering.restaurant'] }),
  Object.freeze({ name: 'activity', query: ['entertainment.bowling_alley', 'entertainment.escape_game', 'entertainment.miniature_golf'] }),
  Object.freeze({ name: 'culture', query: ['entertainment.museum', 'entertainment.culture'] }),
  Object.freeze({ name: 'nature', query: ['leisure.park', 'natural.water'] })
]);
const KEY_NAMES = ['GEOAPIFY_API_KEY', 'DATATOURISME_API_KEY', 'OPENAGENDA_API_KEY'];
const SOURCES = {
  geoapify: 'https://apidocs.geoapify.com/docs/places/',
  datatourisme: 'https://www.datatourisme.fr/faq/',
  openagenda: 'https://developers.openagenda.com/licence/'
};
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
function text(value, max = 600) {
  if (value == null) return null;
  if (Array.isArray(value)) return text(value[0], max);
  if (typeof value === 'object') return text(value.fr ?? value['@fr'] ?? value['@value'] ?? value.label ?? value.name, max);
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  return String(value).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max) || null;
}
const normalized = value => (text(value) || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function coordinates(lat, lon) {
  if (lat == null || lat === '' || lon == null || lon === '') return null;
  lat = Number(lat); lon = Number(lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
function distance(a, b) {
  if (!a || !b) return null;
  const rad = Math.PI / 180, x = (b.lat - a.lat) * rad, y = (b.lon - a.lon) * rad;
  const k = Math.sin(x / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(y / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, k))));
}
function publicUrl(value) {
  try {
    const url = new URL(text(value, 2048));
    // Do not export signed URLs, API URLs, userinfo, query credentials or opaque tokens.
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    if (!url.hostname.includes('.') || /^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return null;
    if (/^(api\.|api-)/.test(url.hostname) || /(?:api[_-]?key|token|secret|signature|oa_sk_|oa_pk_)/i.test(url.href)) return null;
    return url.href;
  } catch { return null; }
}
function links(values, kind) {
  return [...new Set(array(values).flatMap(v => array(v)).map(publicUrl).filter(Boolean))].slice(0, 3)
    .map(url => ({ url, kind, officialStatus: 'candidate_not_independently_verified' }));
}
function date(value) {
  const s = text(value, 80);
  return s && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(s) && Number.isFinite(Date.parse(s)) ? s : null;
}
function intervals(values) {
  return array(values).slice(0, 30).map(t => ({ begin: date(t?.begin ?? t?.startDate), end: date(t?.end ?? t?.endDate ?? t?.startDate) }))
    .filter(t => t.begin && t.end && Date.parse(t.end) >= Date.parse(t.begin));
}
function rightsState(start, end, now) {
  if (start && Date.parse(start) > now) return 'not_started';
  if (end && Date.parse(end) + (end.length === 10 ? 86400000 : 0) <= now) return 'expired';
  return 'within_declared_dates';
}
function dataPhoto(item, now) {
  return array(item.hasMainRepresentation).slice(0, 2).flatMap(rep => {
    const resource = array(rep?.ebucoreHasRelatedResource ?? rep?.hasRelatedResource)[0] || rep;
    const annotation = array(rep?.hasAnnotation ?? resource?.hasAnnotation)[0] || {};
    const url = publicUrl(resource?.ebucoreLocator ?? resource?.locator ?? resource?.url);
    if (!url) return [];
    const credits = text(annotation.credits ?? rep.credits ?? resource.credits);
    const start = date(annotation.rightsStartDate ?? annotation.rightsStartingDate ?? rep.rightsStartingDate);
    const end = date(annotation.rightsEndDate ?? annotation.rightsEndingDate ?? rep.rightsEndingDate);
    const state = rightsState(start, end, now);
    return [{ url, credits, rightsStart: start, rightsEnd: end, rightsState: state,
      declaredLicense: 'Licence Ouverte 2.0 (DATAtourisme platform terms)',
      commercialReuse: credits && state === 'within_declared_dates' ? 'conditional_on_source_rights' : 'not_cleared',
      storage: credits && state === 'within_declared_dates' ? 'conditional_on_source_rights' : 'not_cleared',
      subject: 'provider_associated_not_visually_verified', downloaded: false, terms: SOURCES.datatourisme }];
  });
}
function geoPlace(feature) {
  // Reuse the current pure OSM/Geoapify normalizer, never its caches, fetch or enrichment path.
  const mapped = existingGeoFeature(feature), p = mapped.properties, raw = p.extra || {};
  return {
    id: text(p.place_id), name: text(p.name), city: text(p.city || p.town || p.village),
    coordinates: coordinates(p.lat ?? mapped.geometry?.coordinates?.[1], p.lon ?? mapped.geometry?.coordinates?.[0]),
    address: text(p.formatted || [p.housenumber, p.street, p.postcode, p.city].filter(Boolean).join(' ')),
    phone: text(p.contact?.phone || raw.phone || raw['contact:phone']),
    websites: links([p.website, p.contact?.website, raw.website, raw['contact:website']], 'website_candidate'),
    photos: links([raw.image], 'image_reference_without_license').map(x => ({ url: x.url, commercialReuse: 'not_cleared', storage: 'not_cleared', subject: 'not_verified', downloaded: false })),
    additional: { openingHours: text(p.opening_hours || raw.opening_hours), cuisine: text(p.catering?.cuisine || raw.cuisine), wheelchair: text(p.facilities?.wheelchair ?? raw.wheelchair) },
    dataLicense: 'ODbL; credit Geoapify and OpenStreetMap contributors', source: 'geoapify', terms: SOURCES.geoapify
  };
}
function dataPlace(item, now) {
  item = item && typeof item === 'object' ? item : {};
  const location = array(item.isLocatedAt)[0] || {}, geo = array(location.geo)[0] || {}, address = array(location.address)[0] || {};
  const contacts = array(item.hasContact);
  return {
    id: text(item.uuid || item.uri), name: text(item.label), city: text(address.addressLocality),
    coordinates: coordinates(geo.latitude, geo.longitude),
    address: text([text(address.streetAddress), text(address.postalCode), text(address.addressLocality)].filter(Boolean).join(' ')),
    phone: text(contacts.flatMap(c => array(c?.telephone))[0]),
    websites: links(contacts.flatMap(c => array(c?.homepage)), 'contact_page_candidate'),
    photos: dataPhoto(item, now),
    additional: { description: text(array(item.hasDescription)[0]?.shortDescription ?? array(item.hasDescription)[0]?.description), openingHours: text(location.openingHoursSpecification), types: array(item.type).map(x => text(x, 160)).filter(Boolean).slice(0, 6) },
    source: 'datatourisme', dataLicense: 'Licence Ouverte 2.0', producer: text(array(item.hasBeenCreatedBy)[0]?.legalName ?? array(item.hasBeenCreatedBy)[0]?.name),
    updatedAt: date(item.lastUpdate), terms: SOURCES.datatourisme
  };
}
function match(a, b) {
  const meters = distance(a.coordinates, b.coordinates), sameName = normalized(a.name) && normalized(a.name) === normalized(b.name);
  const samePhone = normalized(a.phone) && normalized(a.phone) === normalized(b.phone);
  const sameAddress = normalized(a.address) && normalized(a.address) === normalized(b.address);
  const sameDomain = a.websites.some(x => b.websites.some(y => new URL(x.url).hostname.replace(/^www\./, '') === new URL(y.url).hostname.replace(/^www\./, '')));
  const status = sameName && ((meters != null && meters <= 150) || samePhone || sameAddress) ? 'strong_correspondence' :
    (sameName || samePhone || (sameDomain && meters != null && meters <= 150)) ? 'probable_review_required' : 'not_matched';
  return { status, distanceMeters: meters, sameName: !!sameName, samePhone: !!samePhone, sameAddress: !!sameAddress, sameDomain };
}
function dataEvent(item, now) {
  return { ...dataPlace(item, now), timings: intervals(item?.takesPlaceAt), timezone: 'Europe/Paris', status: 'not_provided', kind: 'event' };
}
function agendaEvent(item, agenda) {
  item = item && typeof item === 'object' ? item : {};
  const location = item.location || {}, image = item.image || {};
  const imageUrl = publicUrl(image.url || (image.base && image.filename ? image.base + image.filename : null));
  return {
    id: text(item.uid), name: text(item.title), city: text(location.city),
    coordinates: coordinates(location.latitude, location.longitude), address: text(location.address),
    websites: [...links([item.canonicalUrl, location.website], 'publisher_or_venue_page'), ...links(array(item.registration).filter(x => x?.type === 'link').map(x => x.value), 'registration')].slice(0, 4),
    photos: imageUrl ? [{ url: imageUrl, credits: text(item.imageCredits), declaredLicense: null,
      commercialReuse: 'not_cleared_image_license_required', storage: 'not_cleared_image_license_required',
      subject: 'event_illustration_not_venue_photo', downloaded: false, terms: SOURCES.openagenda }] : [],
    dataLicense: text(item.rights?.license?.id ?? item.rights?.license?.name),
    producer: text(item.rights?.licensor?.name), producerUrl: publicUrl(item.rights?.licensor?.url),
    agenda: { id: text(agenda.uid), title: text(agenda.title) }, source: 'openagenda', kind: 'event',
    timings: intervals(item.timings), timezone: text(item.timezone) || 'Europe/Paris',
    status: text(item.status), updatedAt: date(item.updatedAt), additional: { description: text(item.description), conditions: text(item.conditions) }, terms: SOURCES.openagenda
  };
}
function sameCity(item, city) {
  // Lyon arrondissements may be returned as "Lyon 1er" etc.; no surrounding towns.
  const value = normalized(item.city), target = normalized(city.name);
  return value === target || (target === 'lyon' && /^lyon[1-9](?:er|e|eme|arrondissement)?$/.test(value));
}
function inWindow(event, start, end) {
  // A date-only end includes the whole named day; do not invent a session hour.
  return event.timings.some(t => Date.parse(t.end) + (t.end.length === 10 ? 86400000 - 1 : 0) >= start && Date.parse(t.begin) <= end);
}
function eventTheme(event) {
  return /concert|spectacle|animation|theatre|musique|festival/.test(normalized(event.name + ' ' + (event.additional?.description || '') + ' ' + (event.additional?.types || []).join(' ')));
}
function duplicates(items, events = false) {
  const pairs = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j], evidence = match({ ...a, websites: a.websites || [] }, { ...b, websites: b.websites || [] });
    const sameId = a.source === b.source && a.id && a.id === b.id;
    const sameTiming = !events || a.timings.some(x => b.timings.some(y => x.begin === y.begin && x.end === y.end));
    if ((sameId || evidence.status === 'strong_correspondence') && sameTiming) pairs.push({ first: i, second: j, reason: sameId ? 'same_source_id' : 'name_location_and_timing' });
  }
  return pairs;
}
function scrub(value, secrets) {
  if (typeof value === 'string') {
    for (const secret of secrets.filter(Boolean)) {
      for (const variant of [secret, encodeURIComponent(secret)]) value = value.split(variant).join('[REDACTED]');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(x => scrub(x, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, secrets)]));
  return value;
}

async function readJson(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('SIZE');
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') || '')) throw new Error('FORMAT');
  if (!response.body) throw new Error('FORMAT');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('SIZE');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
function createClient({ env, fetchImpl, clock, expiresAt }) {
  const started = clock(), records = [], providers = Object.fromEntries(['geoapify', 'datatourisme', 'openagenda'].map(p => [p, { calls: 0, authentication: 'not_tested', stopped: false }]));
  const allowed = { geoapify: ['api.geoapify.com', '/v2/places', 'POST', 8], datatourisme: ['api.datatourisme.fr', /^\/v1\/(catalog|entertainmentAndEvent)$/, 'GET', 10], openagenda: ['api.openagenda.com', /^\/v2\/agendas(?:\/\d+\/events)?$/, 'GET', 4] };
  async function request(provider, task, url, body) {
    const state = providers[provider], rule = allowed[provider], parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== rule[0] || parsed.port || parsed.username || parsed.password || parsed.hash ||
      !(typeof rule[1] === 'string' ? parsed.pathname === rule[1] : rule[1].test(parsed.pathname)) || /api[_-]?key|token|secret/i.test(parsed.search)) throw new Error('INVALID_DESTINATION');
    if (state.stopped) return { ok: false, code: 'PROVIDER_STOPPED' };
    if (records.length >= MAX_CALLS || state.calls >= rule[3]) return { ok: false, code: 'CALL_BUDGET' };
    if (clock() >= Math.min(started + DEADLINE_MS, expiresAt)) return { ok: false, code: 'DEADLINE' };
    const record = { provider, task, code: 'NETWORK', status: null, durationMs: 0 };
    records.push(record); state.calls++;
    const begin = clock(), controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(REQUEST_MS, started + DEADLINE_MS - clock(), expiresAt - clock())));
    const headers = { Accept: 'application/json' };
    if (provider === 'geoapify') headers['x-api-key'] = env.GEOAPIFY_API_KEY;
    if (provider === 'datatourisme') headers['X-API-Key'] = env.DATATOURISME_API_KEY;
    if (provider === 'openagenda') headers.key = env.OPENAGENDA_API_KEY;
    if (body) headers['Content-Type'] = 'application/json';
    try {
      const response = await fetchImpl(parsed.href, { method: rule[2], headers, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', cache: 'no-store', signal: controller.signal });
      record.status = response.status;
      if (!response.ok) {
        record.code = [401, 403].includes(response.status) ? 'AUTH_OR_ACCESS_DENIED' : response.status === 429 ? 'QUOTA' : 'HTTP';
        if ([401, 403, 429].includes(response.status)) state.stopped = true;
        if ([401, 403].includes(response.status)) state.authentication = 'rejected_or_access_denied';
        if (response.body) await response.body.cancel().catch(() => {});
        return { ok: false, code: record.code };
      }
      state.authentication = 'accepted_for_this_request';
      let data;
      try { data = await readJson(response); }
      catch { record.code = controller.signal.aborted ? 'TIMEOUT' : 'INVALID_OR_OVERSIZED_RESPONSE'; return { ok: false, code: record.code }; }
      record.code = 'OK';
      // Strip accidental credential echoes before they can become a later query.
      return { ok: true, data: scrub(data, [...KEY_NAMES.map(k => env[k]), env.OREVAMI_SORTIES_AUDIT_TOKEN]) };
    } catch { record.code = controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_OR_REDIRECT'; return { ok: false, code: record.code }; }
    finally { clearTimeout(timer); record.durationMs = Math.max(0, clock() - begin); }
  }
  return { request, providers, records };
}

async function runAudit({ env, fetchImpl, clock, expiresAt }) {
  const now = clock(), end = now + 30 * 86400000, client = createClient({ env, fetchImpl, clock, expiresAt });
  const places = [], eventCandidates = [], agendas = [], seen = [];
  const fields = 'uuid,label,type,isLocatedAt,hasContact,hasMainRepresentation,hasDescription,hasBeenCreatedBy,lastUpdate,takesPlaceAt';
  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      const slot = { city: city.name, category: category.name, geoapify: null, datatourisme: null, datatourismeCandidates: [], correspondence: null, notes: [] };
      places.push(slot);
      const geo = await client.request('geoapify', `${city.name}:${category.name}`, 'https://api.geoapify.com/v2/places', {
        categories: category.query, filter: { type: 'circle', lat: city.lat, lon: city.lon, radius: city.radius },
        bias: { type: 'proximity', lat: city.lat, lon: city.lon }, limit: 3, lang: 'fr'
      });
      if (!geo.ok) { slot.notes.push(geo.code); continue; }
      if (!Array.isArray(geo.data?.features)) { slot.notes.push('INVALID_GEOAPIFY_SCHEMA'); continue; }
      const candidates = geo.data.features.slice(0, 3).filter(f => f?.properties && typeof f.properties === 'object').map(geoPlace)
        .filter(p => p.name && !p.name.includes('[REDACTED]') && p.coordinates && sameCity(p, city) && distance(p.coordinates, city) <= city.radius)
        .sort((a, b) => distance(a.coordinates, city) - distance(b.coordinates, city) || (a.id || a.name).localeCompare(b.id || b.name, 'fr'));
      slot.geoapify = candidates.find(p => !seen.some(x => (p.id && x.id === p.id) || match(x, p).status === 'strong_correspondence')) || null;
      if (!slot.geoapify) { slot.notes.push('NO_UNIQUE_PLACE_IN_FIRST_THREE_CITY_RESULTS'); continue; }
      seen.push(slot.geoapify);
      const query = new URL('https://api.datatourisme.fr/v1/catalog');
      query.search = new URLSearchParams({ search: '"' + slot.geoapify.name.replace(/["\\]/g, ' ') + '"', geo_distance: `${slot.geoapify.coordinates.lat},${slot.geoapify.coordinates.lon},1km`, page_size: '3', lang: 'fr', fields }).toString();
      const data = await client.request('datatourisme', `${city.name}:${category.name}`, query);
      if (!data.ok) { slot.notes.push(data.code); continue; }
      if (!Array.isArray(data.data?.objects)) { slot.notes.push('INVALID_DATATOURISME_SCHEMA'); continue; }
      const matches = data.data.objects.slice(0, 3).map(p => dataPlace(p, now)).map(p => ({ place: p, evidence: match(slot.geoapify, p) }));
      slot.datatourismeCandidates = matches;
      const strong = matches.filter(p => p.evidence.status === 'strong_correspondence');
      if (strong.length === 1) { slot.datatourisme = strong[0].place; slot.correspondence = strong[0].evidence; }
      else { slot.correspondence = { status: strong.length > 1 ? 'ambiguous' : 'not_matched', candidatesExamined: matches.length }; slot.notes.push('NO_UNAMBIGUOUS_MATCH'); }
    }
    const eventsUrl = new URL('https://api.datatourisme.fr/v1/entertainmentAndEvent');
    eventsUrl.search = new URLSearchParams({ geo_distance: `${city.lat},${city.lon},5km`, page_size: '2', lang: 'fr', fields,
      filters: `takesPlaceAt.startDate[lte]="${new Date(end).toISOString().slice(0, 10)}" AND takesPlaceAt.endDate[gte]="${new Date(now).toISOString().slice(0, 10)}"` }).toString();
    const de = await client.request('datatourisme', `${city.name}:events`, eventsUrl);
    if (de.ok && !Array.isArray(de.data?.objects)) client.records.at(-1).code = 'INVALID_DATATOURISME_SCHEMA';
    if (de.ok && Array.isArray(de.data?.objects)) eventCandidates.push(...de.data.objects.slice(0, 2).map(p => dataEvent(p, now)).filter(p => p.name && sameCity(p, city) && inWindow(p, now, end) && eventTheme(p)));
    const agendaUrl = new URL('https://api.openagenda.com/v2/agendas');
    agendaUrl.search = new URLSearchParams({ search: city.name, official: '1', size: '1' }).toString();
    const found = await client.request('openagenda', `${city.name}:agenda`, agendaUrl);
    const agenda = found.ok && Array.isArray(found.data?.agendas) ? found.data.agendas[0] : null;
    const uid = String(agenda?.uid || '');
    if (!/^\d{1,20}$/.test(uid)) { agendas.push({ city: city.name, status: found.ok ? 'NO_VALID_AGENDA_IN_FIRST_RESULT' : found.code }); continue; }
    agendas.push({ city: city.name, id: uid, title: text(agenda.title), status: 'selected_first_official_search_result' });
    const oaUrl = new URL(`https://api.openagenda.com/v2/agendas/${uid}/events`);
    oaUrl.search = new URLSearchParams({ size: '2', detailed: '1', monolingual: 'fr', 'adminLevel4[]': city.name,
      'timings[gte]': new Date(now).toISOString(), 'timings[lte]': new Date(end).toISOString(), sort: 'timings.asc' }).toString();
    const oe = await client.request('openagenda', `${city.name}:events`, oaUrl);
    if (oe.ok && !Array.isArray(oe.data?.events)) client.records.at(-1).code = 'INVALID_OPENAGENDA_SCHEMA';
    if (oe.ok && Array.isArray(oe.data?.events)) eventCandidates.push(...oe.data.events.slice(0, 2).map(p => agendaEvent(p, agenda)).filter(p => p.name && sameCity(p, city) && inWindow(p, now, end) && eventTheme(p)));
  }
  const eventDuplicates = duplicates(eventCandidates, true), duplicateSeconds = new Set(eventDuplicates.map(p => p.second));
  const events = CITIES.flatMap(city => eventCandidates.map((event, index) => ({ event, index }))
    .filter(x => sameCity(x.event, city) && !duplicateSeconds.has(x.index)).sort((a, b) => Date.parse(a.event.timings[0].begin) - Date.parse(b.event.timings[0].begin)).slice(0, 2));
  // Keep alternate source evidence only for the <=4 selected events, not extra events.
  const eventVersions = index => [index, ...eventDuplicates.filter(p => p.first === index).map(p => p.second)]
    .map(i => eventCandidates[i]);
  const report = {
    scenario: SCENARIO, generatedAt: new Date(clock()).toISOString(), period: { start: new Date(now).toISOString(), end: new Date(end).toISOString(), timezone: 'Europe/Paris' },
    execution: { maximumCalls: MAX_CALLS, calls: client.records.length, retries: 0, redirectsFollowed: 0, imagesDownloaded: 0, singleUse: 'operator_controlled_no_distributed_lock' },
    providers: client.providers, requests: client.records, places, agendas,
    events: events.map(x => ({ ...x.event, candidateIndex: x.index, sourceVersions: eventVersions(x.index) })),
    eventDuplicates: eventDuplicates.map(pair => ({ ...pair, firstSource: eventCandidates[pair.first].source, firstId: eventCandidates[pair.first].id, secondSource: eventCandidates[pair.second].source, secondId: eventCandidates[pair.second].id })),
    eventSample: { candidatesExamined: eventCandidates.length, accepted: events.length, coverage: 'first_bounded_page_only_not_exhaustive' },
    uiAssessment: { miniaturesV3: 'No automatic activation. Photo rights and actual subject must be reviewed; otherwise use existing graphical fallback.',
      fichesV2: 'Matched identity, contacts, provenance, dates and additional fields are report candidates only. Website official status remains unverified.', changesApplied: false },
    limits: ['Eight fixed place slots; missing results are not replaced by wider searches.', 'At most two unique events per city after deduplication. Event candidates may come from either source.',
      'No independent website visit or image download. Authenticity and official ownership are not certified.', 'Image URLs with query strings are omitted rather than exporting possible credentials.',
      'OpenAgenda agenda search covers only its first official result; no transverse-access request.', 'No persistent storage, app cache, enrichment, OpenAI, Supabase or MyEvent-API calls.']
  };
  return scrub(report, [...KEY_NAMES.map(k => env[k]), env.OREVAMI_SORTIES_AUDIT_TOKEN]);
}

function createHandler({ env = process.env, fetchImpl = (...args) => fetch(...args), clock = Date.now } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const send = (status, code) => res.status(status).json({ error: code });
    if (env.VERCEL_ENV !== 'preview') return send(404, 'NOT_FOUND');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, 'METHOD_NOT_ALLOWED'); }
    const host = req.headers?.host;
    if (!env.VERCEL_URL || !env.VERCEL_URL.endsWith('.vercel.app') || host !== env.VERCEL_URL) return send(403, 'DEPLOYMENT_HOST_REQUIRED');
    if (req.url?.includes('?')) return send(400, 'QUERY_NOT_ALLOWED');
    const token = env.OREVAMI_SORTIES_AUDIT_TOKEN, supplied = req.headers?.['x-orevami-audit-token'];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return send(503, 'AUDIT_DISABLED');
    const hash = value => createHash('sha256').update(value).digest();
    if (typeof supplied !== 'string' || supplied.length > 256 || !timingSafeEqual(hash(supplied), hash(token))) return send(401, 'UNAUTHORIZED');
    const expiresAt = Date.parse(env.OREVAMI_SORTIES_AUDIT_EXPIRES_AT || '');
    if (!Number.isFinite(expiresAt) || expiresAt <= clock() || expiresAt - clock() > 86400000) return send(410, 'EXPIRED_OR_INVALID_WINDOW');
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) return send(415, 'JSON_REQUIRED');
    if (Number(req.headers?.['content-length'] || 0) > 256) return send(413, 'BODY_TOO_LARGE');
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return send(400, 'INVALID_SCENARIO'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'confirm,scenario' || body.scenario !== SCENARIO || body.confirm !== true) return send(400, 'INVALID_SCENARIO');
    const missing = KEY_NAMES.filter(k => typeof env[k] !== 'string' || !env[k].trim());
    if (missing.length) return res.status(503).json({ error: 'MISSING_PROVIDER_KEYS', missing });
    if (KEY_NAMES.some(k => env[k] === token)) return send(503, 'AUDIT_TOKEN_MUST_BE_DISTINCT');
    // No module/global "already ran" flag: Vercel instances do not share state.
    try { return res.status(200).json(await runAudit({ env, fetchImpl, clock, expiresAt })); }
    catch { return send(500, 'AUDIT_FAILED_NO_AUTOMATIC_RETRY'); }
  };
}
module.exports = { createHandler, createClient, match, dataPlace, agendaEvent, publicUrl, duplicates, SCENARIO, CITIES, CATEGORIES };
