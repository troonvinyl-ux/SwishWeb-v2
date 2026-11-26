import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const baseRequest = loadRapidTypescript('src/lib/captureRequest.ts', { '@/lib/supabase': {}, '@/lib/moduleScope': { verifyModuleScope: async () => {} } });
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
function harness({ error = null, lost = false, staleCategory = false, beforeDraft } = {}) {
  let sends = 0, research = 0, listing = null;
  const originals = ['https://fixture.invalid/o.jpg', 'https://fixture.invalid/r.jpg'];
  const category = { id: '990001', name: 'Russia', categoryPath: 'Coins > European > Russia' }; // Fixture only.
  const preparation = { category, specifics: [], missingRequired: [] };
  const checkpoint = { itemId: 'coin', identification: { canonicalTitle: 'Russian copper coin 1759', attributes: { country: 'Russia', year: 1759 } }, generated: { title: 'Russian copper coin 1759', description: 'Visible wear.' }, preparation: staleCategory ? { ...preparation, category: { id: '360', name: 'Art Prints', categoryPath: 'Art > Art Prints' } } : preparation, coinStudio: { prepared: false, photos: originals, warnings: [] } };
  const client = { rpc: async (name, body) => {
    assert.equal(name, 'swish_create_listing_draft'); assert.equal(checkpoint.draftAttempted, true); sends++;
    if (lost) throw new Error('Response lost after send');
    if (error) return { data: null, error };
    assert.equal(body.p_category_id, category.id); listing = { id: 'draft', item_id: 'coin', title: body.p_listing.title, description: body.p_listing.description, status: 'draft' };
    return { data: 'draft', error: null };
  }, from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: listing, error: null }) }; return q; } };
  const request = { ...baseRequest, captureRequest: async () => ({ listing: { title: 'Russian copper coin 1759', description: 'Original coin shown.' } }) };
  const flow = loadRapidTypescript('src/lib/quickCaptureFlow.ts', {
    '@/lib/captureRequest': request, '@/lib/coinCategoryContext': context, '@/lib/coinCategoryPolicy': policy,
    '@/lib/sharedScanPhotos': {}, '@/lib/capturePersistence': { persistCapturePhotos: async () => originals }, '@/lib/itemStudio': {},
    '@/lib/coinListingGate': { assertCoinDraftReady: () => null }, '@/lib/numistaCapture': { captureNumistaReference: () => null },
    '@/lib/scanListingEnrichment': { enrichScannedItemForListing: async () => { research++; return preparation; } },
    '@/lib/scanListingFields': { scanListingAttributes: result => result.attributes, enrichedScanListing: (copy, prep) => ({ ...copy, category_id: prep.category.id, category: prep.category.name }), scanPreparationWarnings: () => [] },
  });
  const options = { scope: { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', isCurrent: () => true }, photos: [], specialistId: 'coins', mode: 'item', answers: {}, checkpoint, onCheckpoint: value => Object.assign(checkpoint, value), onProgress() {}, beforeDraft };
  return { run: () => flow.prepareQuickCapture(options), sends: () => sends, research: () => research, checkpoint, options, request };
}
test('explicit database rejection is retained separately from an uncertain network result', async () => {
  const h = harness({ error: { code: '23514', message: 'Draft check rejected' } });
  await assert.rejects(h.run(), /Draft save rejected/);
  assert.equal(h.checkpoint.draftFailure.outcome, 'rejected'); assert.equal(h.checkpoint.draftFailure.code, '23514'); assert.equal(h.sends(), 1);
});
test('lost responses retain the attempted journal and cannot be replayed by stable preparation', async () => {
  const h = harness({ lost: true }); await assert.rejects(h.run(), /Response lost/);
  assert.equal(h.checkpoint.draftFailure.outcome, 'uncertain'); assert.equal(h.checkpoint.draftAttempted, true);
  const stable = loadRapidTypescript('src/lib/listingStudioPreparation.ts', { '@/lib/captureRequest': h.request, '@/lib/quickCaptureFlow': { prepareQuickCapture: () => assert.fail('No replay') }, '@/lib/captureDraftRecovery': { readOriginalCaptureDraft: async () => null } });
  await assert.rejects(stable.prepareStableQuickCapture(h.options), /uncertain result/); assert.equal(h.sends(), 1);
});
test('a generic error without a transaction rejection code remains uncertain', async () => {
  const h = harness({ error: { message: 'Gateway unavailable' } }); await assert.rejects(h.run()); assert.equal(h.checkpoint.draftFailure.outcome, 'uncertain');
});
test('a failure before the RPC is sent does not mark a draft attempt', async () => {
  const h = harness({ beforeDraft: async () => { throw new Error('Pre-send check failed'); } });
  await assert.rejects(h.run(), /Pre-send/); assert.equal(h.sends(), 0); assert.equal(h.checkpoint.draftAttempted, undefined);
});
test('cached art preparation is discarded and researched again before saving the same coin', async () => {
  const h = harness({ staleCategory: true }), draft = await h.run();
  assert.equal(h.research(), 1); assert.equal(h.sends(), 1); assert.equal(draft.listingId, 'draft'); assert.equal(h.checkpoint.preparation.category.id, '990001');
  assert.deepEqual(draft.photos, ['https://fixture.invalid/o.jpg', 'https://fixture.invalid/r.jpg']);
});
