import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url), ts = require('typescript');

function loadRecovery(stubs) {
  const source = readFileSync('src/lib/listingStatusRecovery.ts', 'utf8');
  const output = ts.transpileModule(source, { fileName: 'src/lib/listingStatusRecovery.ts', compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.equal(output.diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length || 0, 0);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output.outputText)(name => stubs[name], module, module.exports);
  return module.exports;
}

function fixture({ externalId = '1234567890', listingStatus = 'active', itemStatus = 'listed', soldAt = null } = {}) {
  let statusCalls = 0;
  const row = { id: 'listing', tenant_id: 'tenant', marketplace_id: 'ebay', status: listingStatus, external_listing_id: externalId, items: { tenant_id: 'tenant', status: itemStatus, sold_at: soldAt } };
  const client = { from: () => {
    const query = { select: () => query, eq: () => query, single: async () => ({ data: structuredClone(row), error: null }) };
    return query;
  } };
  const recovery = loadRecovery({
    '@/lib/moduleScope': { activateModuleScope: async () => {} },
    '@/lib/supabase': { callEdgeFunction: async () => { statusCalls += 1; return { data: { success: true, results: [{ listingId: 'listing', status: listingStatus }] }, error: null }; } },
  });
  return { recovery, client, statusCalls: () => statusCalls };
}

test('confirmed eBay live status requires its canonical stock item to be live too', async () => {
  const h = fixture();
  const result = await h.recovery.checkSharedListingStatus({ client: h.client, userId: 'user', tenantId: 'tenant', nicheId: 'tunes_flip', listingId: 'listing' });
  assert.equal(result.status, 'active'); assert.equal(result.items.status, 'listed'); assert.equal(h.statusCalls(), 1);
});

test('an eBay-live listing with draft stock remains unreconciled and cannot be reported as successful', async () => {
  const h = fixture({ itemStatus: 'draft' });
  await assert.rejects(() => h.recovery.checkSharedListingStatus({ client: h.client, userId: 'user', tenantId: 'tenant', nicheId: 'tunes_flip', listingId: 'listing' }), /stock still has not moved to Live/);
  assert.equal(h.statusCalls(), 1);
});

test('a draft with no saved eBay identity is not probed or mistaken for a live listing', async () => {
  const h = fixture({ externalId: null, listingStatus: 'draft', itemStatus: 'draft' });
  const result = await h.recovery.checkSharedListingStatus({ client: h.client, userId: 'user', tenantId: 'tenant', nicheId: 'tunes_flip', listingId: 'listing' });
  assert.equal(result.status, 'draft'); assert.equal(h.statusCalls(), 0);
});
