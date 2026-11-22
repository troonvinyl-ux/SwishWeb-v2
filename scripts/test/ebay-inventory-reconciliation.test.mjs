import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
async function pure(path, extra = '') {
  const source = (await readFile(path, 'utf8')).replace(/^import [^\n]+\n/gm, '') + extra;
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}
const lifecycle = await pure('src/lib/inventoryLifecycle.ts');
const ebay = await pure('src/lib/ebaySellerImport.ts', "\nconst getDefaultSpecialistForNiche = niche => niche === 'tunes_flip' ? 'vinyl_records' : 'coins';\n");
const candidate = (id, title = 'Western Satraps, Drachm', status = 'active') => ({
  itemId: id, title, price: 38, ebayStatus: status, categoryId: '4735', categoryName: 'Coins & Paper Money',
  itemSpecifics: [{ name: 'Ruler', value: 'Western Satraps' }, { name: 'Record Grading', value: 'VG+' }, { name: 'Sleeve Grading', value: 'VG' }],
  photos: ['https://i.ebayimg.com/example.jpg'],
});
test('one canonical item with a linked live listing cannot also count as a draft', () => {
  const rows = [
    { id: 'draft', item_id: 'item-1', status: 'draft', external_listing_id: null },
    { id: 'live', item_id: 'item-1', status: 'active', external_listing_id: '123456789012' },
    { id: 'another', item_id: 'item-2', status: 'draft', external_listing_id: null },
  ];
  const result = lifecycle.resolvedInventoryListings(rows);
  assert.deepEqual(result.draft.map(row => row.id), ['another']);
  assert.deepEqual(result.live.map(row => row.id), ['live']);
  assert.equal(lifecycle.hasLiveSibling(rows, 'draft'), true);
  assert.equal(lifecycle.hasLiveSibling(rows, 'live'), false);
});
test('unverified eBay identity, status, price and duplicates never become new active inventory', () => {
  assert.equal(ebay.validatedSellerListing(candidate('bad')), null);
  assert.equal(ebay.validatedSellerListing(candidate('123456789012', 'Coin', 'ended')), null);
  assert.equal(ebay.validatedSellerListing({ ...candidate('123456789012'), price: Number.NaN }), null);
  const known = new Set(['123456789013']);
  const result = ebay.matchEbayCandidates([
    candidate('123456789012'), candidate('123456789013'), candidate('123456789012'),
    candidate('123456789014', 'Record', 'ended'),
  ], known, [{ id: 'stock-coin', title: 'Western Satraps Drachm', status: 'identified' }]);
  assert.equal(result.existing, 1);
  assert.equal(result.ignoredNotActive, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].matches[0].id, 'stock-coin');
});
test('coin imports cannot inherit record grading or fabricated market value', () => {
  const source = ebay.validatedSellerListing(candidate('123456789012'));
  const coins = ebay.canonicalEbayImportPayload(source, 'coins');
  assert.equal(coins.item.specialist_id, 'coins');
  assert.equal(coins.item.valuation_mid, 0);
  assert.equal(coins.item.expected_selling_price, 38);
  assert.equal(coins.item.attributes.media_grade, undefined);
  assert.equal(coins.item.attributes.sleeve_grade, undefined);
  assert.ok(!coins.item.attributes.ebay_item_specifics.some(row => /grading/i.test(row.name)));
  const music = ebay.canonicalEbayImportPayload(source, 'tunes_flip');
  assert.equal(music.item.specialist_id, 'vinyl_records');
  assert.equal(music.item.attributes.media_grade, 'VG+');
  assert.equal(music.item.attributes.sleeve_grade, 'VG');
});
test('real import uses one atomic canonical RPC with current-module verification and readback', async () => {
  const source = await readFile('src/lib/ebaySellerImport.ts', 'utf8');
  assert.match(source, /verifyModuleScope\(client, userId, tenantId, nicheId\)/);
  assert.match(source, /swish_import_ebay_inventory/);
  assert.match(source, /p_existing_item_id: existingItemId \|\| null/);
  assert.match(source, /verified\.data\.external_listing_id !== candidate\.itemId/);
  const publish = await readFile('src/hooks/useListingEditorActions.ts', 'utf8');
  assert.match(publish, /hasLiveSibling\(siblings\.data \|\| \[\], id\)/);
  const inventory = await readFile('src/pages/Inventory.tsx', 'utf8');
  assert.match(inventory, /checkSharedListingStatus/);
  assert.match(inventory, /resolvedInventoryListings\(allListings\)/);
  const importPage = await readFile('src/pages/EbayImport.tsx', 'utf8');
  assert.match(importPage, /EbaySellerDiscovery/);
});
