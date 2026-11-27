import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
const hungary = { id: '992001', name: 'Hungary', isLeaf: true }; // Synthetic fixture ID, never a production default.
const context = { nicheId: 'coins', specialistId: 'coins', title: 'Hungary 1673 Leopold coin', attributes: { country: 'Hungary', year: '1673', ruler: 'Leopold', period: 'hammered' } };
test('normal web lookup and compatibility coin entry send the same native title-suggestion request', async () => {
  const compatibility = loadRapidTypescript('src/lib/resolveCoinCategory.ts');
  const calls = [], invoke = async (endpoint, body) => { calls.push({ endpoint, body }); return { data: { success: true, suggestions: [hungary] }, error: null }; };
  const normal = await lookup.lookupListingCategory('tenant', context.title, invoke, context);
  assert.deepEqual(await compatibility.resolveCoinCategory('tenant', context.title, invoke, context), normal);
  assert.deepEqual(calls, Array.from({ length: 2 }, () => ({ endpoint: 'swish-ebay-category', body: { tenantId: 'tenant', nicheId: 'coins', route: 'get_category_suggestions', query: context.title } })));
  assert.deepEqual(normal, { id: hungary.id, name: 'Hungary' });
});
test('existing coin selection is verified through normal requirements, not replaced by an AI classification', async () => {
  const calls = [], saved = { id: hungary.id, name: hungary.name };
  const result = await lookup.lookupListingCategory('tenant', context.title, async (endpoint, body) => {
    calls.push({ endpoint, body }); return { data: { success: true, categoryId: saved.id, marketplaceId: 'EBAY_GB', isLeaf: true, aspects: [] }, error: null };
  }, { ...context, selectedCategory: saved });
  assert.deepEqual(result, saved); assert.equal(calls.length, 1);
  assert.equal(calls[0].body.route, 'get_category_aspects'); assert.equal(calls[0].body.forceLive, true);
});
test('art and bulk saved categories are discarded before normal coin suggestions, without any mutation', async () => {
  for (const selectedCategory of [{ id: '360', name: 'Art Prints' }, { id: '3410', name: 'Collections/Bulk Lots' }]) {
    const calls = [];
    const result = await lookup.lookupListingCategory('tenant', context.title, async (_endpoint, body) => {
      calls.push(body); return { data: { success: true, suggestions: [selectedCategory, hungary].map(row => ({ ...row, isLeaf: true })) }, error: null };
    }, { ...context, selectedCategory });
    assert.equal(result.id, hungary.id); assert.deepEqual(calls.map(body => body.route), ['get_category_suggestions']);
  }
});
test('old unsaved category failures retry requirements once on the same coin without regenerating copy or duplicating draft', async () => {
  let creates = 0, research = 0, listing;
  const checkpoint = { itemId: 'coin', identification: { canonicalTitle: context.title, specialistId: 'coins', attributes: context.attributes }, photos: {}, coinStudio: { prepared: false, photos: ['obverse', 'reverse'], warnings: [] }, preparation: { category: null, categoryError: 'Retired resolver failed' }, generated: { title: context.title, description: 'Original wear.', recommended_price: 10, floor_price: 5, ceiling_price: 15, item_specifics: {} } };
  const q = { select: () => q, eq: () => q, single: async () => ({ data: listing, error: null }) };
  const client = { from: () => q, rpc: async (name, body) => {
    assert.equal(name, 'swish_create_listing_draft'); assert.equal(body.p_item_id, 'coin'); assert.equal(body.p_category_id, hungary.id);
    assert.equal(body.p_listing.title, context.title); assert.deepEqual(body.p_listing.item_specifics, { Year: '1673' });
    creates++; listing = { id: 'draft', status: 'draft', title: body.p_listing.title, description: body.p_listing.description, price: 10 };
    return { data: 'draft', error: null };
  } };
  const flow = loadRapidTypescript('src/lib/quickCaptureFlow.ts', {
    '@/lib/captureRequest': { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings, assertCaptureScope: async () => {}, captureRequest: async () => assert.fail('No repeat identification or generation') },
    '@/lib/sharedScanPhotos': {}, '@/lib/capturePersistence': { persistCapturePhotos: async () => ['obverse', 'reverse'] }, '@/lib/itemStudio': {},
    '@/lib/coinListingGate': { assertCoinDraftReady: () => null }, '@/lib/numistaCapture': { captureNumistaReference: () => null, parseNumistaNumber: () => null },
    '@/lib/scanListingEnrichment': { enrichScannedItemForListing: async input => {
      assert.equal(input.itemId, 'coin'); research++;
      return { categoryLookupVersion: lookup.CATEGORY_LOOKUP_VERSION, category: { id: hungary.id, name: hungary.name }, categoryError: null, specifics: [{ name: 'Year', value: '1673' }], market: null, missingRequired: [] };
    } }, '@/lib/itemPhotos': { asRecord: rapidRecord },
  });
  const options = { scope: { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins' }, checkpoint, specialistId: 'coins', mode: 'item', answers: {}, photos: [{ slotId: 'obverse' }, { slotId: 'reverse' }], onCheckpoint: patch => Object.assign(checkpoint, patch), onProgress() {} };
  assert.equal((await flow.prepareQuickCapture(options)).listingId, 'draft');
  await flow.prepareQuickCapture(options); assert.equal(creates, 1); assert.equal(research, 1);
});
test('every web preparation entry uses existing generator, category service and canonical RPC', () => {
  for (const file of ['src/lib/quickCaptureFlow.ts', 'src/lib/coinListingPersistence.ts', 'src/pages/NicheCapture.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /enrichScannedItemForListing/); assert.match(source, /swish-list-generate/); assert.match(source, /swish_create_listing_draft/);
    assert.doesNotMatch(source, /route:\s*['"]publish/);
  }
  assert.doesNotMatch(readFileSync('src/lib/categoryLookup.ts', 'utf8'), /(?:browseCoinCategory|resolveCoinCategory|validate_category|get_category_children)/);
});
