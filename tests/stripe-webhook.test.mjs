import test from 'node:test';
import {supabaseEnvironment} from '../server/supabase-environment.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const Stripe = require('stripe');
const stripe = Stripe('sk_test_local_fixture_not_a_real_key');
const secret = 'whsec_local_fixture_not_a_real_secret';
const source = (await readFile(new URL('../api/stripe-webhook.js', import.meta.url), 'utf8')).replace("const {supabaseEnvironment} = await import('../server/supabase-environment.mjs');",'');
const id = '11111111-1111-4111-8111-111111111111';
const paid = {
  id: 'evt_local_fixture', type: 'checkout.session.completed',
  data: { object: { id: 'cs_local_fixture', payment_status: 'paid', metadata: { fund_entry_id: id } } },
};

function setup({ url = 'https://ahyyknfjsielnqyoxqgh.supabase.co', env = {}, response, networkError = false } = {}) {
  const calls = [], logs = [], rows = new Map([[id, { id, status: 'pending', amount: 0.5 }]]);
  const module = { exports: {} };
  vm.runInNewContext(source, {
    require, module, Buffer, URL, supabaseEnvironment,
    process: { env: {
      STRIPE_SECRET_KEY: 'sk_test_local_fixture_not_a_real_key', STRIPE_WEBHOOK_SECRET: secret,
      VERCEL_ENV:'preview',MYEVENT_TEST_SUPABASE_REF:'ahyyknfjsielnqyoxqgh',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake',
      SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: 'local_service_fixture', ...env,
    } },
    console: Object.fromEntries(['log', 'warn', 'error'].map(level => [level, (...args) => logs.push(args)])),
    fetch: async (url, options) => {
      calls.push({ url: new URL(url), ...options });
      if (networkError) throw new Error('network failure with private diagnostic');
      if (response) return response();
      assert.equal(options.method, 'PATCH');
      const key = url.searchParams.get('id').slice(3);
      const row = rows.get(key);
      if (row) Object.assign(row, JSON.parse(options.body));
      return new Response(JSON.stringify(row ? [{ id: row.id, status: row.status }] : []));
    },
  });
  async function invoke(event = paid, { method = 'POST', signature = 'valid', payload } = {}) {
    const body = payload ?? JSON.stringify(event);
    const req = Readable.from([Buffer.from(body)]);
    req.method = method;
    req.headers = { 'stripe-signature': signature === 'valid'
      ? stripe.webhooks.generateTestHeaderString({ payload: body, secret }) : signature };
    const res = {
      status(code) { this.statusCode = code; return this; },
      send(body) { this.body = body; return this; },
      json(body) { this.body = body; return this; },
    };
    await module.exports(req, res);
    return res;
  }
  return { invoke, calls, logs, rows, handler: module.exports };
}

for (const suffix of ['', '/', '///', '/rest/v1', '/rest/v1/', '/rest/v1///']) {
  test(`signed paid event uses exactly one REST prefix (${suffix || 'root'})`, async () => {
    const ctx = setup({ url: `  https://ahyyknfjsielnqyoxqgh.supabase.co${suffix}\r\n` });
    const res = await ctx.invoke();
    assert.equal(res.statusCode, 200);
    assert.equal(ctx.calls[0].url.pathname, '/rest/v1/event_fund_entries');
    assert.equal(ctx.calls[0].url.searchParams.get('id'), `eq.${id}`);
    assert.equal(ctx.calls[0].headers.Prefer, 'return=representation');
    assert.equal(ctx.calls[0].headers.apikey, 'local_service_fixture');
    assert.equal(ctx.calls[0].headers.Authorization, undefined);
    assert.equal(ctx.rows.get(id).status, 'confirmed');
  });
}

test('replaying a paid event confirms the same row without adding money or replacing manual audit fields', async () => {
  const ctx = setup();
  ctx.rows.get(id).confirmed_by = 'manual-manager';
  ctx.rows.get(id).confirmed_at = '2026-09-27T10:00:00Z';
  assert.equal((await ctx.invoke()).statusCode, 200);
  assert.equal((await ctx.invoke()).statusCode, 200);
  assert.equal(ctx.rows.size, 1);
  assert.deepEqual(ctx.rows.get(id), { id, status: 'confirmed', amount: 0.5,
    confirmed_by: 'manual-manager', confirmed_at: '2026-09-27T10:00:00Z' });
  assert.ok(ctx.calls.every(call => call.method === 'PATCH'));
});

test('async successful payments retain automatic confirmation', async () => {
  const ctx = setup();
  assert.equal((await ctx.invoke({ ...paid, type: 'checkout.session.async_payment_succeeded' })).statusCode, 200);
  assert.equal(ctx.rows.get(id).status, 'confirmed');
});

test('unpaid, unrelated and unlinked events never modify a contribution', async () => {
  const ctx = setup();
  for (const event of [
    { ...paid, data: { object: { ...paid.data.object, payment_status: 'unpaid' } } },
    { ...paid, type: 'payment_intent.created' },
    { ...paid, data: { object: { ...paid.data.object, metadata: {} } } },
  ]) assert.equal((await ctx.invoke(event)).statusCode, 200);
  assert.equal(ctx.calls.length, 0);
});

test('GET, missing or invalid signatures are rejected without Supabase access', async () => {
  const ctx = setup();
  assert.equal((await ctx.invoke(paid, { method: 'GET' })).statusCode, 405);
  assert.equal((await ctx.invoke(paid, { signature: '' })).statusCode, 400);
  assert.equal((await ctx.invoke(paid, { signature: 'invalid' })).statusCode, 400);
  assert.equal(ctx.calls.length, 0);
  assert.equal(ctx.handler.config.api.bodyParser, false);
});

test('missing configuration and unsafe URL shapes fail without requesting a malformed route', async () => {
  for (const url of ['', 'bad-url', 'http://project.supabase.co', 'https://ahyyknfjsielnqyoxqgh.supabase.co/wrong',
    'https://ahyyknfjsielnqyoxqgh.supabase.co/?key=private', 'https://ahyyknfjsielnqyoxqgh.supabase.co/#fragment',
    'https://name:private@project.supabase.co']) {
    const ctx = setup({ url });
    assert.equal((await ctx.invoke()).statusCode, 500);
    assert.equal(ctx.calls.length, 0);
    assert.ok(!JSON.stringify(ctx.logs).includes('private'));
  }
  for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const ctx = setup({ env: { [key]: '' } });
    assert.equal((await ctx.invoke()).statusCode, 500);
    assert.equal(ctx.calls.length, 0);
  }
});

test('Supabase errors are retryable and logs exclude response details and credentials', async () => {
  const ctx = setup({ response: () => new Response(JSON.stringify({ code: 'PGRST125', message: 'private diagnostic' }), { status: 404 }) });
  assert.equal((await ctx.invoke()).statusCode, 500);
  const logs = JSON.stringify(ctx.logs);
  assert.ok(logs.includes('PGRST125'));
  assert.ok(!logs.includes('private diagnostic'));
  assert.ok(!logs.includes('local_service_fixture'));
});

test('network failures remain retryable with generic client errors', async () => {
  const ctx = setup({ networkError: true });
  const res = await ctx.invoke();
  assert.equal(res.statusCode, 500);
  assert.ok(!res.body.includes('private diagnostic'));
});

test('a successful HTTP response without exactly one confirmed matching row is not acknowledged', async () => {
  for (const rows of [[], [{ id, status: 'pending' }], [{ id: 'different', status: 'confirmed' }],
    [{ id, status: 'confirmed' }, { id, status: 'confirmed' }]]) {
    const ctx = setup({ response: () => new Response(JSON.stringify(rows)) });
    assert.equal((await ctx.invoke()).statusCode, 500);
  }
});
