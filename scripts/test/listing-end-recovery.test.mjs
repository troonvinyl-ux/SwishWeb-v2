import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const externalId = '123456789012';
function fixture(options = {}) {
  const calls = [], filters = [], activations = [];
  let reads = 0;
  const row = { id: 'listing', item_id: 'item', status: 'active', external_listing_id: externalId, ...options.before };
  const client = { from(table) {
    assert.equal(table, 'listings');
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      async single() {
        reads++;
        return reads === 1 ? { data: row, error: options.readError || null }
          : { data: { ...row, status: 'ended', ...options.saved }, error: options.savedError || null };
      } };
    return query;
  } };
  const output = ts.transpileModule(readFileSync('src/lib/listingStatusRecovery.ts', 'utf8'), {
    fileName: 'src/lib/listingStatusRecovery.ts', reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  assert.equal(output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length || 0, 0);
  const module = { exports: {} };
  const stubs = {
    '@/lib/moduleScope': { async activateModuleScope(...args) { activations.push(args); if (options.scopeError) throw new Error('Scope denied'); } },
    '@/lib/supabase': { async callEdgeFunction(name, body, passedClient) {
      assert.equal(passedClient, client); calls.push({ name, body });
      return options.outcome || { data: { success: true, confirmed: true, externalListingId: externalId }, error: null };
    } },
  };
  new Function('require', 'module', 'exports', output.outputText)(name => stubs[name], module, module.exports);
  return { calls, filters, activations, client, run: () => module.exports.endSharedEbayListing({
    client, userId: 'user', tenantId: 'tenant', nicheId: 'coins', listingId: 'listing',
  }) };
}
test('missing End export uses the existing scoped route once and requires saved Ended status', async () => {
  const h = fixture();
  const saved = await h.run();
  assert.equal(saved.status, 'ended'); assert.equal(saved.external_listing_id, externalId);
  assert.deepEqual(h.activations, [[h.client, 'user', 'tenant', 'coins']]);
  assert.deepEqual(h.calls, [{ name: 'swish-ebay-list', body: {
    route: 'end', tenantId: 'tenant', nicheId: 'coins', listingId: 'listing', itemId: 'item', externalListingId: externalId,
  } }]);
  for (const filter of [['id', 'listing'], ['tenant_id', 'tenant'], ['marketplace_id', 'ebay'], ['items.tenant_id', 'tenant']])
    assert.equal(h.filters.filter(entry => JSON.stringify(entry) === JSON.stringify(filter)).length, 2);
});
test('denied scope, unavailable rows, invalid IDs, pending publication and non-live status send no End', async () => {
  for (const options of [{ scopeError: true }, { readError: { message: 'Denied' } },
    { before: { external_listing_id: 'invalid' } }, { before: { publish_claim_id: 'pending' } },
    { before: { status: 'draft' } }, { before: { status: 'sold' } }, { before: { status: 'ended' } }]) {
    const h = fixture(options); await assert.rejects(h.run); assert.equal(h.calls.length, 0);
  }
});
test('transport errors or unverified provider outcomes never retry or assume local Ended status', async () => {
  for (const outcome of [{ data: null, error: { message: 'Timeout' } }, { data: null, error: null },
    { data: { success: true, externalListingId: externalId }, error: null },
    { data: { success: false, confirmed: true, externalListingId: externalId }, error: null },
    { data: { success: true, confirmed: true, externalListingId: '999999999999' }, error: null }]) {
    const h = fixture({ outcome }); await assert.rejects(h.run); assert.equal(h.calls.length, 1);
  }
});
test('provider confirmation without exact saved readback stays pending without another End request', async () => {
  for (const options of [{ saved: { status: 'active' } }, { saved: { external_listing_id: '999999999999' } },
    { savedError: { message: 'Readback failed' } }]) {
    const h = fixture(options); await assert.rejects(h.run, /saved status is still pending/); assert.equal(h.calls.length, 1);
  }
});
test('linked coin local removal remains separate from marketplace ending', () => {
  const actions = readFileSync('src/components/features/InventoryListingActions.tsx', 'utf8');
  const local = actions.slice(actions.indexOf('export function RemoveFromSwishAction'), actions.indexOf('export function InventoryPriceAction'));
  assert.match(local, /mode:'exclude_local_legacy'/);
  assert.match(local, /result\.data\.archived!==true/);
  assert.match(local, /_swish_ebay_sync_excluded/);
  assert.doesNotMatch(local, /endSharedEbayListing|route:\s*'end'/);
  assert.match(actions, /await endSharedEbayListing\(/);
});
