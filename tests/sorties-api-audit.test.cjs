'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
// Any accidental network call (including at import time) fails this suite.
global.fetch = () => { throw new Error('LIVE_NETWORK_FORBIDDEN'); };
const { createHandler, createClient, match, dataPlace, agendaEvent, publicUrl, CITIES } = require('../server/sorties-api-audit');
const NOW = Date.parse('2026-10-25T12:00:00Z');
const TOKEN = 'a'.repeat(64);
const env = () => ({ VERCEL_ENV: 'preview', VERCEL_URL: 'audit-example.vercel.app',
  OREVAMI_SORTIES_AUDIT_TOKEN: TOKEN, OREVAMI_SORTIES_AUDIT_EXPIRES_AT: '2026-10-25T13:00:00Z',
  GEOAPIFY_API_KEY: 'fake-geo-key', DATATOURISME_API_KEY: 'fake-data-key', OPENAGENDA_API_KEY: 'fake-agenda-key' });
function request() { return { method: 'POST', url: '/api/sorties-api-audit', headers: { host: 'audit-example.vercel.app', 'x-orevami-audit-token': TOKEN, 'content-type': 'application/json' }, body: { scenario: 'gap-lyon-v1', confirm: true } }; }
function response() { return { headers: {}, statusCode: null, payload: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(p) { this.payload = p; return this; } }; }
const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
async function invoke({ config = env(), req = request(), fetchImpl = () => { throw Error('unexpected'); }, clock = () => NOW } = {}) {
  const res = response(); await createHandler({ env: config, fetchImpl, clock })(req, res); return res;
}

test('entry point is a Node/CommonJS handler with no calls at import', () => {
  assert.equal(typeof require('../api/[search]'), 'function');
});
test('fail-closed guards never call a provider', async t => {
  const cases = [
    ['production', c => { c.VERCEL_ENV = 'production'; }, null, 404],
    ['missing environment', c => { delete c.VERCEL_ENV; }, null, 404],
    ['no token configured', c => { delete c.OREVAMI_SORTIES_AUDIT_TOKEN; }, null, 503],
    ['token reused as provider key', c => { c.GEOAPIFY_API_KEY = TOKEN; }, null, 503],
    ['expired', c => { c.OREVAMI_SORTIES_AUDIT_EXPIRES_AT = '2026-10-25T11:00:00Z'; }, null, 410],
    ['invalid expiry', c => { c.OREVAMI_SORTIES_AUDIT_EXPIRES_AT = 'invalid'; }, null, 410],
    ['too long window', c => { c.OREVAMI_SORTIES_AUDIT_EXPIRES_AT = '2026-10-30T12:00:00Z'; }, null, 410],
    ['GET', null, r => { r.method = 'GET'; }, 405],
    ['HEAD', null, r => { r.method = 'HEAD'; }, 405],
    ['OPTIONS', null, r => { r.method = 'OPTIONS'; }, 405],
    ['missing token', null, r => { delete r.headers['x-orevami-audit-token']; }, 401],
    ['wrong token', null, r => { r.headers['x-orevami-audit-token'] = 'b'.repeat(64); }, 401],
    ['duplicate token', null, r => { r.headers['x-orevami-audit-token'] = [TOKEN, TOKEN]; }, 401],
    ['custom host', null, r => { r.headers.host = 'orevami.com'; }, 403],
    ['query token', null, r => { r.url += '?token=anything'; }, 400],
    ['arbitrary scenario', null, r => { r.body.scenario = 'other-city'; }, 400],
    ['extra fields', null, r => { r.body.limit = 100; }, 400],
    ['no confirmation', null, r => { r.body.confirm = false; }, 400],
    ['malformed JSON', null, r => { r.body = '{'; }, 400],
    ['no content type', null, r => { delete r.headers['content-type']; }, 415],
    ['large body', null, r => { r.headers['content-length'] = '257'; }, 413],
    ['missing provider key', c => { delete c.OPENAGENDA_API_KEY; }, null, 503]
  ];
  for (const [name, changeConfig, changeRequest, expected] of cases) await t.test(name, async () => {
    const config = env(), req = request(); changeConfig?.(config); changeRequest?.(req); let calls = 0;
    const res = await invoke({ config, req, fetchImpl: () => { calls++; throw Error('unexpected'); } });
    assert.equal(res.statusCode, expected); assert.equal(calls, 0);
    assert.equal(res.headers['Cache-Control'], 'no-store, private');
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
    assert.ok(!JSON.stringify(res.payload).includes(TOKEN));
  });
});

function fixtureProvider(calls, options = {}) {
  const selected = new Map(); let ordinal = 0;
  return async (input, init) => {
    const url = new URL(input); calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    for (const key of [TOKEN, ...Object.values(env()).filter(x => String(x).startsWith('fake-'))]) assert.ok(!url.href.includes(key));
    if (url.hostname === 'api.geoapify.com') {
      assert.equal(init.headers['x-api-key'], env().GEOAPIFY_API_KEY); assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body), city = body.filter.lat > 45 ? CITIES[1] : CITIES[0];
      assert.equal(body.limit, 3); assert.equal(body.filter.radius, 5000);
      const name = `${city.name} Lieu ${ordinal++}`, geo = { latitude: city.lat + ordinal * 0.0001, longitude: city.lon };
      const item = { uuid: 'data-' + ordinal, label: { fr: name }, type: ['PlaceOfInterest'],
        isLocatedAt: { geo, address: { streetAddress: `${ordinal} rue Test`, postalCode: city.name === 'Gap' ? '05000' : '69001', addressLocality: city.name } },
        hasContact: [{ homepage: ['https://venue.example.org/'], telephone: '0400000000' }],
        hasMainRepresentation: [{ hasAnnotation: { credits: 'Photographe', rightsEndDate: '2026-12-31' }, ebucoreHasRelatedResource: [{ ebucoreLocator: 'https://images.example.org/photo.jpg' }] }],
        hasBeenCreatedBy: [{ legalName: 'Office Test' }], lastUpdate: '2026-10-24' };
      selected.set(name, item);
      return json({ features: [{ type: 'Feature', geometry: { coordinates: [geo.longitude, geo.latitude] }, properties: {
        name, place_id: 'geo-' + ordinal, lat: geo.latitude, lon: geo.longitude, city: city.name,
        formatted: `${ordinal} rue Test ${city.name === 'Gap' ? '05000' : '69001'} ${city.name}`, categories: body.categories,
        datasource: { raw: { website: 'https://venue.example.org/', phone: '0400000000' } }
      } }] });
    }
    if (url.hostname === 'api.datatourisme.fr') {
      assert.equal(init.headers['X-API-Key'], env().DATATOURISME_API_KEY);
      if (options.dataDenied) return new Response('never echoed ' + env().DATATOURISME_API_KEY, { status: options.dataDenied });
      if (url.pathname.endsWith('/catalog')) {
        const name = url.searchParams.get('search').replace(/^"|"$/g, '');
        return json({ objects: [selected.get(name)], meta: { next: 'https://api.datatourisme.fr/v1/catalog?api_key=DO_NOT_EXPORT' } });
      }
      const city = url.searchParams.get('geo_distance').startsWith('44') ? CITIES[0] : CITIES[1];
      return json({ objects: [1, 2].map(i => ({ uuid: `${city.name}-event-${i}`, label: { fr: `Concert ${city.name} ${i}` },
        isLocatedAt: { geo: { latitude: city.lat, longitude: city.lon }, address: { addressLocality: city.name } },
        takesPlaceAt: [{ startDate: `2026-10-${26 + i}`, endDate: `2026-10-${26 + i}` }],
        hasDescription: [{ shortDescription: { fr: 'Concert de musique' } }], hasContact: [], lastUpdate: '2026-10-24'
      })) });
    }
    assert.equal(url.hostname, 'api.openagenda.com'); assert.equal(init.headers.key, env().OPENAGENDA_API_KEY);
    const city = url.searchParams.get('search') === 'Gap' || url.searchParams.get('adminLevel4[]') === 'Gap' ? CITIES[0] : CITIES[1];
    if (!url.pathname.endsWith('/events')) return json({ agendas: [{ uid: city.name === 'Gap' ? 1 : 2, title: city.name }] });
    return json({ events: [1, 2].map(i => ({ uid: city.name + i, title: `Concert ${city.name} ${i}`,
      location: { city: city.name, latitude: city.lat, longitude: city.lon },
      timings: [{ begin: `2026-10-${26 + i}`, end: `2026-10-${26 + i}` }],
      image: { base: 'https://cdn.openagenda.com/main/', filename: 'photo.jpg' }, imageCredits: 'Auteur',
      rights: { license: { id: 'etalab-2.0' }, licensor: { name: 'Éditeur' } }, updatedAt: '2026-10-24', status: 1
    })) });
  };
}
test('complete mocked scenario: exactly 22 calls, eight matches, four events, cross-source duplicates', async () => {
  const calls = [], res = await invoke({ fetchImpl: fixtureProvider(calls) });
  assert.equal(res.statusCode, 200); assert.equal(calls.length, 22); assert.equal(res.payload.execution.calls, 22);
  assert.deepEqual(Object.values(res.payload.providers).map(p => p.calls), [8, 10, 4]);
  assert.equal(res.payload.places.length, 8); assert.ok(res.payload.places.every(p => p.correspondence.status === 'strong_correspondence'));
  assert.equal(res.payload.events.length, 4); assert.equal(res.payload.eventDuplicates.length, 4);
  assert.ok(res.payload.events.every(e => e.sourceVersions.length === 2));
  assert.ok(res.payload.events.every(e => e.sourceVersions.some(v => v.source === 'openagenda')));
  assert.equal(res.payload.execution.imagesDownloaded, 0);
  assert.ok(!JSON.stringify(res.payload).includes('DO_NOT_EXPORT'));
  assert.ok(res.payload.places.every(p => p.geoapify.websites[0].officialStatus.includes('not_independently')));
});
test('401, 403 and quota stop subsequent calls to that provider without retries', async t => {
  for (const status of [401, 403, 429]) await t.test(String(status), async () => {
    const calls = [], res = await invoke({ fetchImpl: fixtureProvider(calls, { dataDenied: status }) });
    assert.equal(res.statusCode, 200); assert.equal(res.payload.providers.datatourisme.calls, 1);
    assert.ok(res.payload.providers.datatourisme.stopped); assert.equal(calls.length, 13);
    assert.ok(!JSON.stringify(res.payload).includes(env().DATATOURISME_API_KEY));
  });
});
test('network error details are discarded and no automatic retry happens', async () => {
  const calls = []; const fetchImpl = async (url, init) => { calls.push(url); throw Error(env().GEOAPIFY_API_KEY + init.headers.key + TOKEN); };
  const res = await invoke({ fetchImpl });
  assert.equal(res.statusCode, 200); assert.equal(calls.length, 12); // 8 Geo + 2 Data events + 2 agenda searches
  assert.ok(res.payload.requests.every(r => r.code === 'NETWORK_OR_REDIRECT'));
  for (const value of [TOKEN, ...Object.values(env()).filter(x => String(x).startsWith('fake-'))]) assert.ok(!JSON.stringify(res.payload).includes(value));
});
test('central client enforces hard total and per-provider ceilings even if called too many times', async () => {
  let calls = 0; const config = env();
  const client = createClient({ env: config, clock: () => NOW, expiresAt: NOW + 3600000, fetchImpl: async () => { calls++; return json({}); } });
  for (let i = 0; i < 30; i++) await client.request('geoapify', 'bounded', 'https://api.geoapify.com/v2/places', {});
  for (let i = 0; i < 30; i++) await client.request('datatourisme', 'bounded', 'https://api.datatourisme.fr/v1/catalog');
  for (let i = 0; i < 30; i++) await client.request('openagenda', 'bounded', 'https://api.openagenda.com/v2/agendas');
  assert.equal(calls, 22); assert.equal(client.records.length, 22);
  await assert.rejects(client.request('geoapify', 'bad', 'https://api.geoapify.com/v2/places?apiKey=key'), /INVALID_DESTINATION/);
  await assert.rejects(client.request('openagenda', 'bad', 'https://evil.example.org/'), /INVALID_DESTINATION/);
  await assert.rejects(client.request('datatourisme', 'bad', 'https://api.datatourisme.fr/v1/catalog/123/contact'), /INVALID_DESTINATION/);
});
test('expiration and global deadline stop additional requests', async () => {
  let now = NOW, calls = 0;
  const client = createClient({ env: env(), clock: () => now, expiresAt: NOW + 3600000, fetchImpl: async () => { calls++; now += 200000; return json({}); } });
  await client.request('openagenda', 'first', 'https://api.openagenda.com/v2/agendas');
  assert.equal((await client.request('openagenda', 'second', 'https://api.openagenda.com/v2/agendas')).code, 'DEADLINE');
  assert.equal(calls, 1);
});
test('malformed, oversized, redirect and invalid content-type responses are not exported', async t => {
  for (const make of [() => new Response('not json', { headers: { 'content-type': 'application/json' } }),
    () => new Response('private upstream html', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '2000000' } }),
    () => new Response('x'.repeat(1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
    () => new Response(null, { status: 302, headers: { location: 'https://evil.example.org/' } })]) await t.test('bounded response', async () => {
    const client = createClient({ env: env(), clock: () => NOW, expiresAt: NOW + 3600000, fetchImpl: async () => make() });
    const result = await client.request('openagenda', 'test', 'https://api.openagenda.com/v2/agendas');
    assert.equal(result.ok, false); assert.equal(client.records.length, 1); assert.equal(result.data, undefined);
  });
});
test('all secret echoes are redacted from allowed report fields; no raw payload or logs', async () => {
  const calls = [], base = fixtureProvider(calls); let logs = 0;
  const oldLog = console.log, oldError = console.error, oldWarn = console.warn;
  console.log = console.error = console.warn = () => { logs++; };
  try {
    const fetchImpl = async (url, init) => {
      const r = await base(url, init), data = await r.json();
      if (data.objects?.[0]) data.objects[0].hasBeenCreatedBy = [{ legalName: Object.values(env()).join(' ') }];
      return json(data);
    };
    const res = await invoke({ fetchImpl }), output = JSON.stringify(res.payload);
    for (const key of [TOKEN, env().GEOAPIFY_API_KEY, env().DATATOURISME_API_KEY, env().OPENAGENDA_API_KEY]) assert.ok(!output.includes(key));
    assert.ok(output.includes('[REDACTED]')); assert.equal(logs, 0);
  } finally { console.log = oldLog; console.error = oldError; console.warn = oldWarn; }
});
test('name-only or domain-only identity is never a strong match; coordinates do not turn null into zero', () => {
  const a = { name: 'Le Lac', coordinates: null, phone: null, address: null, websites: [] };
  assert.equal(match(a, a).status, 'probable_review_required');
  assert.equal(dataPlace({ label: { fr: 'Test' }, isLocatedAt: { geo: { latitude: null, longitude: null } } }, NOW).coordinates, null);
});
test('photos distinguish expired rights, absent credits and event illustration licenses', () => {
  const item = { hasMainRepresentation: [{ hasAnnotation: { credits: 'Auteur', rightsEndDate: '2020-01-01' }, ebucoreHasRelatedResource: [{ ebucoreLocator: 'https://images.example.org/a.jpg' }] }] };
  const photo = dataPlace(item, NOW).photos[0]; assert.equal(photo.rightsState, 'expired'); assert.equal(photo.storage, 'not_cleared');
  delete item.hasMainRepresentation[0].hasAnnotation.credits;
  assert.equal(dataPlace(item, NOW).photos[0].commercialReuse, 'not_cleared');
  const event = agendaEvent({ image: { base: 'https://cdn.openagenda.com/main/', filename: 'a.jpg' }, imageCredits: 'Auteur', rights: { license: { id: 'etalab-2.0' } } }, {});
  assert.equal(event.photos[0].storage, 'not_cleared_image_license_required');
  assert.equal(event.photos[0].subject, 'event_illustration_not_venue_photo');
});
test('credential-bearing/signed URLs and userinfo never enter the report', () => {
  for (const value of ['https://a.example.org/a?token=secret', 'https://user:password@a.example.org/', 'https://a.example.org/oa_pk_secret', 'http://127.0.0.1/', 'javascript:alert(1)']) assert.equal(publicUrl(value), null);
});
test('credential echo in a place name cannot be forwarded to another provider URL', async () => {
  const calls = [], base = fixtureProvider(calls);
  const res = await invoke({ fetchImpl: async (url, init) => {
    const r = await base(url, init), data = await r.json();
    if (data.features?.[0]) data.features[0].properties.name = env().GEOAPIFY_API_KEY;
    return json(data);
  } });
  assert.equal(res.statusCode, 200);
  assert.ok(calls.every(c => !c.url.href.includes(env().GEOAPIFY_API_KEY)));
  assert.ok(res.payload.places.every(p => p.geoapify === null));
});
test('invalid provider object entries produce missing results instead of crashing', async () => {
  const calls = [], base = fixtureProvider(calls);
  const res = await invoke({ fetchImpl: async (url, init) => {
    const r = await base(url, init), data = await r.json();
    if (data.features) data.features = [{ properties: null }, null];
    if (data.objects) data.objects = [null];
    if (data.events) data.events = [null];
    return json(data);
  } });
  assert.equal(res.statusCode, 200); assert.equal(res.payload.events.length, 0);
});
test('Vercel config keeps branch auto-deployment off and blocks public server source', () => {
  const config = require('../vercel.json');
  assert.equal(config.git.deploymentEnabled['temp/orevami-sorties-api-audit-20261025'], false);
  assert.equal(config.functions['api/[search].js'].maxDuration, 240);
  assert.equal(config.functions['api/sorties-api-audit.js'], undefined);
  const rule = config.routes.find(r => r.src && new RegExp(r.src).test('/server/sorties-api-audit.js'));
  assert.equal(rule.status, 404);
});
