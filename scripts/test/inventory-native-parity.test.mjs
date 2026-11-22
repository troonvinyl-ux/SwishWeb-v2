import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
function load(path, stubs = {}) {
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
  const mod = { exports: {} };
  new Function('require','module','exports',compiled.outputText)(name => stubs[name] || require(name), mod, mod.exports);
  return mod.exports;
}
const m = load('src/lib/inventoryNative.ts');
const counts = (values = {}) => ({
  total: 2, units: 2, stock: 1, draft: 0, live: 1, sold: 0,
  archived: 0, live_listings: 1, revision: 'a'.repeat(32), ...values,
});
const entry = (id, tab = 'live', price = 20, suggested = 18) => ({
  item_id: id, specialist_id: 'coins', inventory_tab: tab, sort_at: '2026-11-22T13:00:00Z',
  item: { id, tenant_id: 'tenant', specialist_id: 'coins', canonical_title: id === 'one' ? 'Ancient coin' : 'Medieval coin',
    expected_selling_price: suggested, created_at: id === 'one' ? '2026-11-22T11:00:00Z' : '2026-11-22T12:00:00Z',
    attributes: { numista_type_id: '438449', storage_location: 'Box 1' } },
  listing: tab === 'stock' ? null : { id: 'listing-' + id, item_id: id, tenant_id: 'tenant', marketplace_id: 'ebay',
    status: 'active', external_listing_id: '123456789012', price, floor_price: 5, ceiling_price: 40, views: 5, watchers: 2 },
});
test('canonical RPC counts enforce exact item classifications, revision and status totals', () => {
  assert.deepEqual(m.parseCanonicalCounts(counts()).total, 2);
  assert.throws(() => m.parseCanonicalCounts(counts({ total: 3 })), /categories/);
  assert.throws(() => m.parseCanonicalCounts(counts({ revision: 'invalid' })), /revision/);
  assert.throws(() => m.parseCanonicalCounts(counts({ status_counts: { listed: 1 } })), /status/);
  assert.throws(() => m.parseCanonicalCounts({ ...counts(), stock: '1' }), /count contract/);
});
test('one physical item is one row in one native tab, not one row per listing', () => {
  const rows = m.projectInventoryRows([entry('one'), entry('two', 'stock')], 'tenant', ['coins']);
  assert.deepEqual(rows.map(row => [row.id, row.tab]), [['one','live'], ['two','stock']]);
  assert.deepEqual(m.inventoryCountsInView(rows), { stock: 1, draft: 0, live: 1, sold: 0, archived: 0 });
  assert.throws(() => m.projectInventoryRows([entry('one'), entry('one')], 'tenant', ['coins']), /duplicates/);
  assert.throws(() => m.projectInventoryRows([entry('one')], 'other', ['coins']), /inconsistent/);
  assert.throws(() => m.projectInventoryRows([entry('one')], 'tenant', ['vinyl_records']), /inconsistent/);
});
test('search, sorting and original SWISH suggestion match native inventory behaviour', () => {
  const rows = m.projectInventoryRows([entry('one'), entry('two', 'stock')], 'tenant', ['coins']);
  assert.equal(m.recommendedInventoryPrice(rows[0]), 18);
  assert.equal(m.recommendedInventoryPrice(rows[1]), null);
  assert.deepEqual(m.searchInventory(rows, '438449').map(row => row.id), ['one','two']);
  assert.deepEqual(m.searchInventory(rows, 'box 1').map(row => row.id), ['one','two']);
  assert.deepEqual(m.orderInventory(rows, 'newest').map(row => row.id), ['two','one']);
  assert.deepEqual(m.orderInventory(rows, 'title').map(row => row.id), ['one','two']);
});
test('one-click live price only uses saved expected_selling_price; no repeated 5% discount', () => {
  const rows = [
    entry('one', 'live', 20, 19), // saved recommendation 19 (not 18.05)
    entry('two', 'live', 20, 20),
    entry('three', 'live', 20, 15),
    entry('four', 'live', 20, 21),
  ];
  rows[2].listing.floor_price = 17;
  rows[3].item.attributes.ebay_listing_options = { listingType: 'Chinese' };
  const projected = m.projectInventoryRows(rows, 'tenant', ['coins']);
  assert.equal(m.recommendedInventoryPrice(projected[0]), 19);
  assert.equal(m.recommendedInventoryPrice(projected[1]), null);
  assert.equal(m.recommendedInventoryPrice(projected[2]), null);
  assert.equal(m.recommendedInventoryPrice(projected[3]), null);
});
test('web inventory is wired to native OnSpace views and explicit linked status/price actions', () => {
  const inventory = readFileSync('src/pages/Inventory.tsx','utf8');
  const cards = readFileSync('src/components/features/InventoryCard.tsx','utf8');
  const actions = readFileSync('src/components/features/InventoryListingActions.tsx','utf8');
  const listings = readFileSync('src/pages/Listings.tsx','utf8');
  const editor = readFileSync('src/pages/ListingEditor.tsx','utf8');
  const button = readFileSync('src/components/features/RecommendedPriceButton.tsx','utf8');
  assert.match(inventory, /readNativeInventory/);
  assert.doesNotMatch(inventory, /resolvedInventoryListings|useTable\('items'/);
  assert.match(cards, /ListingStatusAction/);
  assert.match(cards, /InventoryPriceAction/);
  assert.match(actions, /checkSharedListingStatus/);
  assert.match(actions, /reviseSharedListingPrice/);
  assert.match(actions, /uncertainRevisions/);
  assert.match(listings, /ListingStatusAction/);
  assert.match(editor, /suggestedPrice=\{draft.item\?\.expected_selling_price\}/);
  assert.match(button, /saved\*100/);
});
