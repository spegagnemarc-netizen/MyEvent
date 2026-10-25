'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
global.fetch = () => { throw Error('LIVE_NETWORK_FORBIDDEN'); };
const { createHandler } = require('../server/sorties-api-audit');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'api/[search].js'), 'utf8');
const NOW = Date.parse('2026-10-25T12:00:00Z');
const token = 'a'.repeat(64);
const config = () => ({ VERCEL_ENV: 'preview', VERCEL_URL: 'audit-example.vercel.app',
  OREVAMI_SORTIES_AUDIT_TOKEN: token, OREVAMI_SORTIES_AUDIT_EXPIRES_AT: '2026-10-25T13:00:00Z',
  GEOAPIFY_API_KEY: 'fake-geo', DATATOURISME_API_KEY: 'fake-data', OPENAGENDA_API_KEY: 'fake-agenda' });
function res() { return { headers: {}, statusCode: null, payload: null, setHeader(k,v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(p) { this.payload = p; return this; } }; }
function req(url = '/api/sorties-api-audit') { return { url, method: 'POST', headers: { host: 'audit-example.vercel.app', 'content-type': 'application/json', 'x-orevami-audit-token': token }, body: { scenario: 'gap-lyon-v1', confirm: true } }; }
function load(auditHandler = (req,res) => res.status(209).json({ route: 'audit' })) {
  const calls = [], loads = [], imports = [], module = { exports: {} };
  const context = vm.createContext({ module, require(specifier) {
    loads.push(specifier);
    if (specifier === '../server/sorties-api-audit') return { createHandler() { return auditHandler; } };
    const route = ({ '../server/search-accommodation': 'accommodation', '../server/search-transport': 'transport', '../server/search-ticketmaster': 'ticketmaster' })[specifier];
    assert.ok(route, 'Only expected modules may be loaded');
    return (request, response) => { calls.push({ route, request, response }); return response.status(208).json({ route }); };
  } });
  new vm.Script(source, { filename: path.join(root, 'api/[search].js'),
    importModuleDynamically: async specifier => {
      imports.push(specifier);
      assert.equal(specifier, '../server/account-deletion-request.mjs');
      const stub = new vm.SourceTextModule('export default (req,res) => res.status(207).json({route:"account-deletion",url:req.url,method:req.method});', { context });
      await stub.link(() => { throw Error('Unexpected dependency'); }); await stub.evaluate(); return stub;
    }
  }).runInContext(context);
  return { handler: module.exports, calls, loads, imports };
}
test('existing paths forward identical request/response without audit dispatch', async t => {
  for (const [pathname, route] of [['search-accommodation','accommodation'], ['search-accommodation.js','accommodation'], ['search-transport','transport'], ['search-transport.js','transport'], ['search-ticketmaster','ticketmaster'], ['search-ticketmaster.js','ticketmaster']]) {
    await t.test(pathname, async () => {
      const loaded = load(), request = req(`/api/${pathname}?sorties-api-audit=1`), response = res();
      request.method = route === 'ticketmaster' ? 'GET' : 'POST';
      await loaded.handler(request, response);
      assert.equal(response.statusCode, 208); assert.equal(response.payload.route, route);
      assert.equal(loaded.calls[0].request, request); assert.equal(loaded.calls[0].response, response);
      assert.ok(!loaded.loads.includes('../server/sorties-api-audit')); assert.equal(loaded.imports.length, 0);
    });
  }
});
test('account deletion keeps its dynamic import and unchanged method/path', async () => {
  const loaded = load(), request = req('/api/account-deletion?anything=1'), response = res(); request.method = 'DELETE';
  await loaded.handler(request,response);
  assert.equal(response.statusCode,207); assert.equal(response.payload.method,'DELETE');
  assert.equal(response.payload.url,request.url); assert.equal(loaded.imports.length,1);
  assert.ok(!loaded.loads.includes('../server/sorties-api-audit'));
});
test('audit loads only on exact path and never falls through into business routes', async () => {
  let captured;
  const loaded = load((request,response) => { captured = request; return response.status(209).json({ ok:true }); });
  assert.ok(!loaded.loads.includes('../server/sorties-api-audit'));
  const request = req(), response = res(); await loaded.handler(request,response);
  assert.equal(response.statusCode,209); assert.equal(captured,request);
  assert.equal(loaded.calls.length,0); assert.equal(loaded.imports.length,0);
});
test('unknown/lookalike paths cannot select audit', async () => {
  for (const url of ['/api/unknown?audit=1','/api/sorties-api-audit.js','/api/sorties-api-audit/','/api/sorties-api-audit-extra','/api/%73orties-api-audit']) {
    const loaded = load(), response = res(); await loaded.handler(req(url),response);
    assert.equal(response.statusCode,404); assert.ok(!loaded.loads.includes('../server/sorties-api-audit'));
  }
});
test('actual audit guards survive routing without provider calls or fallthrough', async t => {
  for (const [name, change, status] of [
    ['production', (env,r) => { env.VERCEL_ENV='production'; },404],
    ['GET', (env,r) => { r.method='GET'; },405],
    ['missing token', (env,r) => { delete r.headers['x-orevami-audit-token']; },401],
    ['expired', env => { env.OREVAMI_SORTIES_AUDIT_EXPIRES_AT='2026-10-25T11:00:00Z'; },410],
    ['wrong host', (env,r) => { r.headers.host='orevami.com'; },403],
    ['query parameters', (env,r) => { r.url+='?key=forbidden'; },400],
    ['wrong scenario', (env,r) => { r.body.scenario='other'; },400]
  ]) await t.test(name,async () => {
    const env=config(), request=req(), response=res(); let providerCalls=0; change(env,request);
    const loaded=load(createHandler({env,clock:()=>NOW,fetchImpl:()=>{ providerCalls++; throw Error('Forbidden'); }}));
    await loaded.handler(request,response); assert.equal(response.statusCode,status); assert.equal(providerCalls,0);
    assert.equal(loaded.calls.length,0); assert.equal(loaded.imports.length,0);
    assert.equal(response.headers['Cache-Control'],'no-store, private');
    assert.equal(response.headers['Access-Control-Allow-Origin'],undefined);
    assert.ok(!JSON.stringify(response.payload).includes(token));
  });
});
test('exactly twelve deployable JS entries; duration moved; auto-deployment disabled', () => {
  const files=fs.readdirSync(path.join(root,'api')).filter(f=>f.endsWith('.js')).sort();
  assert.deepEqual(files, ['[search].js','analyze-poll.js','camera-ai.js','create-payment-session.js','generate-avatar.js','generate-materials.js','generate-outing-plan.js','search-halls.js','search-music.js','search-places.js','stripe-webhook.js','summarize-event.js'].sort());
  assert.equal(files.length,12);
  const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  assert.equal(vercel.functions['api/[search].js'].maxDuration,240);
  assert.equal(vercel.functions['api/sorties-api-audit.js'],undefined);
  assert.equal(vercel.git.deploymentEnabled['temp/orevami-sorties-api-audit-20261025'],false);
});
test('server audit is unchanged from approved commit: 22-call budget and guards preserved', () => {
  const original=execFileSync('git',['show','be236a73448d5fa8c0f5164484496bbe572c1292:server/sorties-api-audit.js'],{cwd:root});
  const current=fs.readFileSync(path.join(root,'server/sorties-api-audit.js'));
  assert.deepEqual(current,original);
});
