import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
test('discarding AI coin-category guesses keeps the RPC-required empty specifics object', () => {
  const draft = policy.discardGeneratedCoinCategory({ title: 'Collector-labelled coin', item_specifics: { Artist: 'AI guess' }, category_id: '360', recommended_price: 12 });
  assert.deepEqual(draft.item_specifics, {}); assert.equal(draft.category_id, undefined); assert.equal(draft.recommended_price, 12);
});
function harness(specifics = undefined) {
  let sends = 0, row = null;
  const checkpoint = { itemId: 'physical-id', identification: { canonicalTitle: 'Russian coin', specialistId: 'coins' }, photos: {}, coinStudio: { prepared: false, photos: ['obverse', 'reverse'], warnings: [] },
    preparation: { category: null }, generated: { title: 'Russian coin', description: 'Visible wear.', recommended_price: 12, floor_price: 10, ceiling_price: 15 } };
  if (specifics !== undefined) checkpoint.generated.item_specifics = specifics;
  const q = { select: () => q, eq: () => q, single: async () => ({ data: row, error: null }) };
  const client = { from: () => q, rpc: async (name, body) => {
    assert.equal(name, 'swish_create_listing_draft'); assert.equal(body.p_item_id, 'physical-id');
    assert.ok(body.p_listing.item_specifics && !Array.isArray(body.p_listing.item_specifics));
    assert.deepEqual(body.p_listing.item_specifics, {}); sends++;
    row = { id: 'draft', status: 'draft', title: body.p_listing.title, description: body.p_listing.description, price: 12 };
    return { data: 'draft', error: null };
  } };
  const capture = { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings, assertCaptureScope: async () => {}, captureRequest: async () => assert.fail('Cached preparation must not re-identify or regenerate') };
  const flow = loadRapidTypescript('src/lib/quickCaptureFlow.ts', {
    '@/lib/captureRequest': capture, '@/lib/sharedScanPhotos': {}, '@/lib/capturePersistence': { persistCapturePhotos: async () => ['obverse', 'reverse'] }, '@/lib/itemStudio': {},
    '@/lib/coinListingGate': { assertCoinDraftReady: () => null }, '@/lib/numistaCapture': { captureNumistaReference: () => null, parseNumistaNumber: () => null },
    '@/lib/scanListingEnrichment': {}, '@/lib/scanListingFields': { scanListingAttributes: rapidRecord, scanPreparationWarnings: () => [] },
    '@/lib/coinCategoryPolicy': policy, '@/lib/coinCategoryContext': loadRapidTypescript('src/lib/coinCategoryContext.ts'),
  });
  const options = { scope: { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', isCurrent: () => true }, checkpoint, specialistId: 'coins', mode: 'item', answers: {}, photos: [{ slotId: 'obverse' }, { slotId: 'reverse' }], onCheckpoint: patch => Object.assign(checkpoint, patch), onProgress() {} };
  return { run: () => flow.prepareQuickCapture(options), sends: () => sends, checkpoint };
}
test('legacy coin checkpoint missing specifics is repaired before RPC, not left in a rejection loop', async () => {
  for (const specifics of [undefined, null, []]) {
    const h = harness(specifics), result = await h.run(); assert.equal(result.listingId, 'draft'); assert.equal(h.sends(), 1);
    assert.deepEqual(h.checkpoint.generated.item_specifics, {});
    await h.run(); assert.equal(h.sends(), 1);
  }
});
