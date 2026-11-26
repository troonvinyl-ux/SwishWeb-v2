import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
function harness(prepared) {
  const calls = [], checkpoint = {}; let listing, creates = 0, current = true;
  const client = { rpc: async (name, body) => { assert.equal(name, 'swish_create_listing_draft'); calls.push('draft'); creates++; listing = { id: 'draft', title: body.p_listing.title, description: body.p_listing.description, status: 'draft' }; return { data: 'draft', error: null }; }, from: table => { assert.equal(table, 'listings'); const q = { select: () => q, eq: () => q, single: async () => ({ data: listing, error: null }) }; return q; } };
  const request = { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings, assertCaptureScope: async () => { if (!current) throw Error('Scope changed'); }, captureRequest: async (_scope, name) => { calls.push(name); return name === 'swish-identify' ? { identification: { canonicalTitle: 'Worn copper coin', specialistId: 'coins' } } : { listing: { title: 'Worn copper coin', description: 'Original wear and patina visible.' } }; } };
  const originals = ['https://example.test/o.jpg', 'https://example.test/r.jpg'];
  const flow = loadRapidTypescript('src/lib/quickCaptureFlow.ts', {
    '@/lib/sharedScanPhotos': { prepareScanPhotos: async () => ({ images: ['YQ==', 'Yg=='], imageLabels: ['Obverse', 'Reverse'], slots: ['obverse', 'reverse'] }) }, '@/lib/captureRequest': request,
    '@/lib/capturePersistence': { persistCaptureItem: async () => { calls.push('item'); return 'coin'; }, persistCapturePhotos: async () => { calls.push('originals'); return originals; } },
    '@/lib/itemStudio': { prepareSavedCoinPhotos: async (_u, _t, _id, urls) => { calls.push('studio'); assert.deepEqual(urls, originals); return { prepared, photos: prepared ? ['https://example.test/studio/o.png', 'https://example.test/studio/r.png'] : originals, warnings: prepared ? [] : ['Originals retained'] }; } },
    '@/lib/coinCategoryPolicy': loadRapidTypescript('src/lib/coinCategoryPolicy.ts'),
    '@/lib/coinCategoryContext': loadRapidTypescript('src/lib/coinCategoryContext.ts'),
    '@/lib/coinListingGate': { assertCoinDraftReady: () => null }, '@/lib/numistaCapture': { prepareNumistaFaces: async () => [], captureNumistaReference: () => null, parseNumistaNumber: () => null },
    '@/lib/scanListingEnrichment': { enrichScannedItemForListing: async input => { assert.deepEqual(input.imageUrls, originals); calls.push('research'); return { category: null }; } },
    '@/lib/scanListingFields': { scanListingAttributes: value => value, enrichedScanListing: value => value, scanPreparationWarnings: () => [] },
  });
  const options = { scope: { client, nicheId: 'coins', tenantId: 'tenant', userId: 'seller', isCurrent: () => current }, photos: [{ slotId: 'obverse', file: {} }, { slotId: 'reverse', file: {} }], specialistId: 'coins', mode: 'item', answers: {}, checkpoint, onCheckpoint: value => Object.assign(checkpoint, value), onProgress() {} };
  return { run: () => flow.prepareQuickCapture(options), calls, creates: () => creates, expire: () => { current = false; } };
}
test('Done prepares a pair before draft generation and keeps ORIGINAL photographs in identification/research', async () => {
  const h = harness(true), result = await h.run();
  assert.deepEqual(h.calls, ['swish-identify', 'item', 'originals', 'studio', 'research', 'swish-list-generate', 'draft']);
  assert.deepEqual(result.photos, ['https://example.test/studio/o.png', 'https://example.test/studio/r.png']);
  await h.run(); assert.equal(h.calls.filter(name => name === 'studio').length, 1); assert.equal(h.creates(), 1);
});
test('unsafe processing still completes the same factual draft using originals without a new screen or publication', async () => {
  const h = harness(false), result = await h.run(); assert.equal(result.listingId, 'draft'); assert.deepEqual(result.photos, ['https://example.test/o.jpg', 'https://example.test/r.jpg']); assert.match(result.warnings.join(' '), /Originals retained/); assert.equal(h.creates(), 1);
});
