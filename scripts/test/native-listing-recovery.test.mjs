import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
function load(path, stubs = {}) {
  const mod = { exports: {} }, result = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
  assert.deepEqual(result.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error) || [], []);
  new Function('require', 'module', 'exports', result.outputText)(name => stubs[name], mod, mod.exports); return mod.exports;
}
function fixture(patch = {}, stock = 'listed') {
  let row = { id: 'listing', tenant_id: 'tenant', item_id: 'stock', status: 'draft', publish_claim_id: 'original-server-claim', external_listing_id: null, items: { tenant_id: 'tenant', status: stock, sold_at: null }, ...patch };
  const calls = [], filters = [], client = { from: table => { assert.equal(table, 'listings'); const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, single: async () => ({ data: structuredClone(row), error: null }) }; return q; } };
  const service = load('src/lib/listingStatusRecovery.ts', {
    '@/lib/moduleScope': { activateModuleScope: async () => {} },
    '@/lib/supabase': { callEdgeFunction: async (name, body) => { calls.push({ name, body }); row = { ...row, status: 'active', publish_claim_id: null, external_listing_id: body.externalListingId }; return { data: { success: true, externalListingId: body.externalListingId }, error: null }; } },
  });
  return { service, calls, filters, input: { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', listingId: 'listing', externalListingId: '123456789012' } };
}
test('recovery uses the original claim route and exact item identity, never a new publication', async () => {
  const h = fixture(), fresh = await h.service.recoverSharedPendingPublication(h.input);
  assert.equal(fresh.status, 'active'); assert.equal(fresh.publish_claim_id, null);
  assert.deepEqual(h.calls, [{ name: 'swish-ebay-list', body: { route: 'recover_pending_publish', tenantId: 'tenant', nicheId: 'coins', listingId: 'listing', externalListingId: '123456789012' } }]);
  assert.ok(h.filters.some(([key, value]) => key === 'tenant_id' && value === 'tenant'));
  assert.ok(h.filters.some(([key]) => key === 'items.tenant_id'));
});
test('a legacy draft without a stock SKU can request backend verification; it cannot bypass stock reconciliation', async () => {
  const h = fixture({}, 'draft');
  await assert.rejects(h.service.recoverSharedPendingPublication(h.input), /stock still has not moved to Live/); assert.equal(h.calls.length, 1);
});
test('a different saved item number and missing server claim fail before invocation', async () => {
  const changed = fixture({ external_listing_id: '999999999999' });
  await assert.rejects(changed.service.recoverSharedPendingPublication(changed.input), /identity changed/); assert.equal(changed.calls.length, 0);
  const absent = fixture({ publish_claim_id: null });
  await assert.rejects(absent.service.recoverSharedPendingPublication(absent.input), /No pending server claim/); assert.equal(absent.calls.length, 0);
});
test('accepted item numbers survive a remount and stay user/tenant/listing scoped', () => {
  const recovery = load('src/lib/acceptedPublication.ts'), own = 'seller:tenant:listing', other = 'another:tenant:listing';
  recovery.retainAcceptedPublication(own, '123456789012'); assert.equal(recovery.readAcceptedPublication(own), '123456789012'); assert.equal(recovery.readAcceptedPublication(other), null);
  recovery.retainAcceptedPublication(other, 'invalid'); assert.equal(recovery.readAcceptedPublication(other), null);
  recovery.clearAcceptedPublication(own); assert.equal(recovery.readAcceptedPublication(own), null);
});
