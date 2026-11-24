import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const output = ts.transpileModule(readFileSync('src/lib/inventoryLifecycle.ts', 'utf8'), {
  fileName: 'inventoryLifecycle.ts',
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
assert.equal(output.diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length || 0, 0);
const module = { exports: {} };
new Function('module', 'exports', output.outputText)(module, module.exports);
const { hasLiveSibling, resolvedInventoryListings } = module.exports;
const live = { id: 'live-listing', item_id: 'stock', status: 'active', external_listing_id: '1234567890' };
test('a separate recorded live listing blocks another submission', () => {
  for (const status of ['active', 'live', 'ACTIVE']) {
    assert.equal(hasLiveSibling([{ ...live, status }], 'original-draft'), true);
  }
});
test('the current listing is not its own sibling', () => {
  assert.equal(hasLiveSibling([live], live.id), false);
  assert.equal(hasLiveSibling([], 'original-draft'), false);
});
test('drafts, ended listings and invalid external IDs are not verified live siblings', () => {
  for (const status of ['draft', 'pending', 'ended', 'failed', 'cancelled', 'sold']) {
    assert.equal(hasLiveSibling([{ ...live, status }], 'original-draft'), false);
  }
  for (const external_listing_id of [null, '', 'unconfirmed', '12345', '1'.repeat(21)]) {
    assert.equal(hasLiveSibling([{ ...live, external_listing_id }], 'original-draft'), false);
  }
});
test('a verified live sibling excludes only its linked stock drafts without mutating records', () => {
  const draft = { id: 'original-draft', item_id: 'stock', status: 'draft' };
  const other = { id: 'other-draft', item_id: 'other-stock', status: 'pending' };
  const rows = [draft, live, other], snapshot = JSON.stringify(rows);
  const resolved = resolvedInventoryListings(rows);
  assert.deepEqual(resolved.draft, [other]);
  assert.deepEqual(resolved.live, [live]);
  assert.deepEqual([...resolved.linkedLiveItems], ['stock']);
  assert.equal(JSON.stringify(rows), snapshot);
  assert.deepEqual(resolvedInventoryListings([draft, { ...live, external_listing_id: null }]).draft, [draft]);
});
