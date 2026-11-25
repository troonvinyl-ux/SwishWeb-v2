import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const cache = new Map();
let calls = [], response, scopeError;
const transports = {
  '@/lib/moduleScope': { activateModuleScope: async (...args) => { calls.push(['scope', ...args.slice(1)]); if (scopeError) throw scopeError; } },
  '@/lib/supabase': {
    getSupabaseClientAsync: async () => ({ from: () => { throw new Error('No direct policy reads or writes allowed'); } }),
    callEdgeFunction: async (name, body) => { calls.push(['invoke', name, body]); return response; },
  },
};
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  const result = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(value => value.category === ts.DiagnosticCategory.Error).length || 0, 0);
  new Function('require', 'module', 'exports', result.outputText)(name => {
    if (transports[name]) return transports[name];
    if (!name.startsWith('@/')) return require(name);
    const base = `src/${name.slice(2)}`; return load(existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`);
  }, module, module.exports);
  cache.set(path, module.exports); return module.exports;
}
const { loadListingDeliveryPolicy, deliveryCharge } = load('src/lib/listingDeliveryPolicy.ts');
const { listingDeliveryError } = load('src/lib/listingDeliveryError.ts');
const scope = { userId: 'seller', tenantId: 'tenant', nicheId: 'coins', externalId: '' };
test.beforeEach(() => { calls = []; scopeError = null; response = { data: { policy: null }, error: null }; });

test('selected delivery is a scoped read of the existing route, never an inferred default', async () => {
  assert.equal(await loadListingDeliveryPolicy(scope), null);
  assert.deepEqual(calls, [['scope', 'seller', 'tenant', 'coins'], ['invoke', 'swish-ebay-list', { route: 'get_selected_delivery_policy', tenantId: 'tenant', nicheId: 'coins' }]]);
});
test('missing authentication and failed module authorization never request eBay policy data', async () => {
  await assert.rejects(loadListingDeliveryPolicy({ ...scope, userId: undefined }), error => error.kind === 'authentication');
  assert.deepEqual(calls, []);
  scopeError = new Error('The active module changed or is not authorized.');
  await assert.rejects(loadListingDeliveryPolicy(scope), /active module/);
  assert.equal(calls.length, 1);
});
test('worker boot failure is actionable and does not expose its trace or internal path', async () => {
  const trace = 'Invocation failed: worker boot error: failed to create the graph: Module not found file:///models/iwgaqieyoahmcjfziwga/_shared/deliveryProfileRoutes.ts';
  response = { data: null, error: { status: 503, message: trace } };
  await assert.rejects(loadListingDeliveryPolicy(scope), error => {
    assert.equal(error.kind, 'deployment'); assert.equal(error.status, 503);
    assert.match(error.message, /deployment needs repair/); assert.doesNotMatch(error.message, /file:|models|worker boot|deliveryProfileRoutes/); return true;
  });
});
test('invalid HTTP success is not mistaken for no selected policy', async () => {
  for (const data of [null, {}, { success: true }, { policy: {} }, { policy: { fulfillmentPolicyId: 'id', shippingOptions: 'invalid' } }]) {
    response = { data, error: null };
    await assert.rejects(loadListingDeliveryPolicy(scope), error => error.kind === 'response');
  }
});
test('live response details and charges are retained without guessing unknown services', async () => {
  const policy = { fulfillmentPolicyId: 'selected', name: 'Seller policy', localPickup: false, shippingOptions: [{ optionType: 'DOMESTIC', shippingServices: [{ shippingCost: { currency: 'GBP', value: '3.49' } }] }] };
  response = { data: { policy }, error: null };
  assert.deepEqual(await loadListingDeliveryPolicy(scope), policy);
  assert.equal(deliveryCharge(policy.shippingOptions[0].shippingServices[0]), '£3.49');
  assert.equal(deliveryCharge({ freeShipping: true }), 'Free for buyer');
  assert.equal(deliveryCharge({}), 'Price unavailable');
  assert.equal(deliveryCharge({}, 'CALCULATED'), 'Calculated by eBay');
});
test('error categories remain safe for network, authentication and stale route responses', () => {
  assert.equal(listingDeliveryError({ message: 'Failed to fetch' }).kind, 'network');
  assert.equal(listingDeliveryError({ status: 403, message: 'secret diagnostic' }).kind, 'authentication');
  assert.equal(listingDeliveryError({ status: 400, message: 'Unknown route' }).kind, 'deployment');
  assert.doesNotMatch(listingDeliveryError({ message: 'arbitrary internal diagnostic' }).message, /arbitrary internal/);
});
test('rendered notice contains safe feedback and retry controls, not the backend exception', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom');
  const Notice = load('src/components/features/ListingDeliveryErrorNotice.tsx').default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Notice, { error: { status: 503, message: 'worker boot error file:///models/private/module.ts' }, retrying: true, onRetry: () => {} })));
  assert.match(html, /Delivery check unavailable/); assert.match(html, /disabled/); assert.match(html, /HTTP 503/);
  assert.match(html, /policies/); assert.match(html, /overflow-wrap:anywhere/); assert.doesNotMatch(html, /file:\/\/\/|private\/module|worker boot error/);
});
