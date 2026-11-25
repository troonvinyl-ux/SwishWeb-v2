import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord, rapidText } from './lib/load-rapid-typescript.mjs';
const request = { assertCaptureScope: async () => {}, captureRecord: rapidRecord, captureText: rapidText };
test('a lost original item-insert response recovers by the same physical UUID, never by title', async () => {
  let row = null, inserts = 0;
  const client = { from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }), insert: value => { inserts++; row = { ...value }; return { select: () => ({ single: async () => ({ data: null, error: { message: 'Network response lost after commit' } }) }) }; } }; return q; } };
  const service = loadRapidTypescript('src/lib/capturePersistence.ts', { '@/lib/captureRequest': request, '@/lib/numistaCapture': { parseNumistaNumber: () => null }, '@/lib/sharedScanPhotos': {} });
  const scope = { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', isCurrent: () => true };
  await assert.rejects(service.persistCaptureItem(scope, { canonicalTitle: 'Same title as another coin' }, 'coins', {}, 'item', 'physical-uuid'), /lost after commit/);
  assert.equal(await service.persistCaptureItem(scope, { canonicalTitle: 'Same title as another coin' }, 'coins', {}, 'item', 'physical-uuid'), 'physical-uuid');
  assert.equal(inserts, 1); assert.equal(row.weight_grams, null); assert.deepEqual(row.dimensions_mm, {}); assert.equal(row.attributes._rapid_capture_id, 'physical-uuid');
});
test('an uncertain draft attempt is never automatically replayed', async () => {
  let calls = 0; const q = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
  const service = loadRapidTypescript('src/lib/listingStudioPreparation.ts', { '@/lib/captureRequest': request, '@/lib/quickCaptureFlow': { prepareQuickCapture: async () => { calls++; } } });
  await assert.rejects(service.prepareStableQuickCapture({ scope: { client: { from: () => q }, tenantId: 'tenant' }, checkpoint: { itemId: 'physical-id', draftAttempted: true }, onCheckpoint() {}, onProgress() {} }), /draft save has an uncertain result/); assert.equal(calls, 0);
});
test('Market, Quick Sale and Recommended use shared pricing evidence, independent of AI confidence', () => {
  const itemPricing = loadRapidTypescript('src/lib/itemPricing.ts', { '@/lib/itemPhotos': { asRecord: rapidRecord } });
  const price = loadRapidTypescript('src/lib/rapidCoinPricing.ts', { '@/lib/itemPhotos': { asRecord: rapidRecord }, '@/lib/itemPricing': itemPricing });
  const base = { attributes: { market_value_result: { valuation: { fairMarketValue: 100, recommendedListingPrice: 110, valuationLow: 90, valuationHigh: 130 }, recommendation: { quickSaleRatio: .9 }, soldMarket: { verifiedSoldCount: 6, medianPrice: 98, dataQualityReason: 'Six completed comparables' }, activeAskingPrices: { medianAskingPrice: 140 } } } };
  const low = price.rapidCoinPrices({ ...base, identification_confidence: .1 }), high = price.rapidCoinPrices({ ...base, identification_confidence: .99 });
  assert.deepEqual(low, high); assert.equal(low.market, 100); assert.equal(low.quick, 90); assert.equal(low.recommended, 110); assert.equal(low.soldMedian, 98); assert.equal(low.askingMedian, 140);
  const unavailable = price.rapidCoinPrices(null); assert.equal(unavailable.quick, null); assert.equal(unavailable.market, null);
  const askingOnly = price.rapidCoinPrices({ attributes: { market_value_result: { soldMarket: { verifiedSoldCount: 0, medianPrice: 90 }, activeAskingPrices: { medianAskingPrice: 140 } } } }); assert.equal(askingOnly.soldMedian, null); assert.equal(askingOnly.askingMedian, 140);
});
