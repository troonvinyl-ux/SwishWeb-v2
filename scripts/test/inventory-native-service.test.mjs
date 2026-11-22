import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
function load(path, stubs = {}) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.equal(output.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
  const mod = { exports: {} };
  new Function('require','module','exports',output.outputText)(name => stubs[name] || require(name), mod, mod.exports);
  return mod.exports;
}
const pure = load('src/lib/inventoryNative.ts');
const fixture = (id, tab = 'stock') => ({
  item_id: id, specialist_id: 'coins', inventory_tab: tab,
  item: { id, tenant_id: 'tenant', specialist_id: 'coins', canonical_title: 'Coin ' + id },
  listing: null,
  sort_at: '2026-11-22T12:00:00Z',
});
function inventoryClient(rows, total = rows.length) {
  const calls = [];
  const counts = {
    total, units: total, stock: total, draft: 0, live: 0, sold: 0, archived: 0,
    live_listings: 0, revision: 'a'.repeat(32),
  };
  const backendResult = data => ({
    abortSignal() { return this; },
    then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); },
  });
  const client = {
    rpc(name, args) {
      calls.push({ name, args });
      return backendResult(counts);
    },
    from(table) {
      calls.push({ from: table });
      return {
        select(columns) { calls.push({ select: columns }); return this; },
        eq(col, value) { calls.push({ eq: [col, value] }); return this; },
        in(col, values) { calls.push({ in: [col, values] }); return this; },
        order(col, sort) { calls.push({ order: [col, sort] }); return this; },
        range(from, to) { calls.push({ range: [from, to] }); this.start = from; this.end = to; return this; },
        abortSignal() { return this; },
        then(resolve, reject) { return Promise.resolve({
          data: rows.slice(this.start, this.end + 1), error: null,
        }).then(resolve, reject); },
      };
    },
  };
  return { client, calls };
}
test('canonical inventory pages over 200 records with exactly the native RLS scope and verified counts', async () => {
  const rows = Array.from({ length: 201 }, (_, i) => fixture(String(i)));
  const { client, calls } = inventoryClient(rows);
  let activated = 0, verified = 0;
  const { readNativeInventory } = load('src/lib/inventoryNativeRead.ts', {
    '@/lib/moduleScope': {
      activateModuleScope: async () => { activated++; },
      verifyModuleScope: async () => { verified++; },
    },
    '@/lib/inventoryNative': pure,
  });
  const result = await readNativeInventory(client, 'user', 'tenant', 'coins', ['coins']);
  assert.equal(result.entries.length, 201);
  assert.equal(result.counts.total, 201);
  assert.equal(activated, 1);
  assert.equal(verified, 1);
  assert.deepEqual(calls.filter(x => x.range).map(x => x.range), [[0, 199], [200, 399]]);
  assert.deepEqual(calls.filter(x => x.name === 'swish_inventory_tab_counts').map(x => x.args),
    Array.from({ length: 2 }, () => ({ p_tenant_id: 'tenant', p_niche_id: 'coins' })));
  assert.deepEqual(calls.filter(x => x.from).map(x => x.from),
    ['swish_inventory_canonical_rows','swish_inventory_canonical_rows']);
  assert.ok(calls.some(x => x.eq?.[0] === 'tenant_id' && x.eq?.[1] === 'tenant'));
  assert.ok(calls.some(x => x.in?.[0] === 'specialist_id' && x.in?.[1][0] === 'coins'));
});
test('incomplete or repeated physical inventory is rejected, never presented as canonical zero', async () => {
  const { readNativeInventory } = load('src/lib/inventoryNativeRead.ts', {
    '@/lib/moduleScope': { activateModuleScope: async () => {}, verifyModuleScope: async () => {} },
    '@/lib/inventoryNative': pure,
  });
  const { client } = inventoryClient([fixture('one')], 2);
  await assert.rejects(() => readNativeInventory(client, 'user', 'tenant', 'coins', ['coins']), /changed while loading/);
  const bad = inventoryClient([fixture('one'), fixture('one')]);
  await assert.rejects(() => readNativeInventory(bad.client, 'user', 'tenant', 'coins', ['coins']), /duplicates/);
});
test('price-only revision invokes the native route once and requires both provider and SWISH saved readback', async () => {
  const calls = []; let verified = 0;
  const { reviseSharedListingPrice } = load('src/lib/inventoryPriceRevision.ts', {
    '@/lib/moduleScope': { activateModuleScope: async () => {}, verifyModuleScope: async () => { verified++; } },
    '@/lib/supabase': { callEdgeFunction: async (name, body) => {
      calls.push({ name, body });
      return { data: { success: true, verified: true, price: 19, externalListingId: '123456789012' }, error: null };
    } },
  });
  const client = {
    from(table) {
      assert.equal(table, 'listings');
      return {
        select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: { id: 'listing', external_listing_id: '123456789012', price: 19 }, error: null }),
      };
    },
  };
  const input = { client, userId: 'user', tenantId: 'tenant', nicheId: 'coins',
    listingId: 'listing', expectedExternalId: '123456789012', newPrice: 19, expectedPrice: 20 };
  const result = await reviseSharedListingPrice(input);
  assert.deepEqual({ confirmed: result.confirmed, price: result.price }, { confirmed: true, price: 19 });
  assert.equal(verified, 1);
  assert.deepEqual(calls, [{ name: 'swish-ebay-list', body: {
    route: 'revise_price', tenantId: 'tenant', nicheId: 'coins',
    listingId: 'listing', newPrice: 19, expectedPrice: 20,
  } }]);
  assert.equal(Object.keys(calls[0].body).some(k => /photo|title|quantity|publish/i.test(k)), false);
});
test('unconfirmed price result remains blocked; a failed transport never implies successful price revision', async () => {
  let count = 0;
  const { reviseSharedListingPrice } = load('src/lib/inventoryPriceRevision.ts', {
    '@/lib/moduleScope': { activateModuleScope: async () => {}, verifyModuleScope: async () => {} },
    '@/lib/supabase': { callEdgeFunction: async () => {
      count++; return { data: null, error: { message: 'eBay accepted but readback pending', status: 503,
        body: { accepted: true, unconfirmed: true } } };
    } },
  });
  const result = await reviseSharedListingPrice({ client: {}, userId: 'user', tenantId: 'tenant',
    nicheId: 'coins', listingId: 'listing', expectedExternalId: '123456789012', newPrice: 19, expectedPrice: 20 });
  assert.equal(count, 1); assert.equal(result.confirmed, false); assert.equal(result.unconfirmed, true);
});
