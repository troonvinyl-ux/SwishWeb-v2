import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidFixture, rapidRecord } from './lib/load-rapid-typescript.mjs';
import { rapidMemoryIdb } from './lib/rapid-memory-idb.mjs';
function harness(patch = {}) {
  globalThis.indexedDB = rapidMemoryIdb().api; globalThis.window = { dispatchEvent() {} };
  const db = loadRapidTypescript('src/lib/rapidCoinDatabase.ts'), types = loadRapidTypescript('src/types/rapidCoin.ts');
  let row = { id: 'listing', item_id: 'coin-1', tenant_id: 'tenant', marketplace_id: 'ebay', status: 'draft', external_listing_id: null, publish_claim_id: null, updated_at: 'v1', ...patch.row };
  const stock = { id: 'coin-1', tenant_id: 'tenant', status: 'draft', sold_at: null, ...patch.stock };
  let reads = 0, writes = 0, retained = patch.retained || null;
  const client = { from(table) {
    const q = { select: () => q, eq: () => q, update() { writes++; throw Error('No server writes permitted'); },
      single: async () => { reads++; if (patch.failed) return { data: null, error: { message: 'Unavailable' } }; if (patch.race && reads === 3) row = { ...row, publish_claim_id: 'concurrent' }; return { data: structuredClone(table === 'items' ? stock : row), error: null }; },
      then(resolve) { return Promise.resolve({ data: [structuredClone(row), ...(patch.siblings || [])], error: null }).then(resolve); } };
    return q;
  } };
  const service = loadRapidTypescript('src/lib/rapidPublicationRecovery.ts', { '@/lib/rapidCoinDatabase': db, '@/lib/acceptedPublication': { readAcceptedPublication: () => retained }, '@/lib/moduleScope': { verifyModuleScope: async () => { if (patch.scopeError) throw Error('Scope changed'); } }, '@/lib/itemPhotos': { asRecord: rapidRecord } });
  const publication = loadRapidTypescript('src/lib/rapidCoinPublication.ts', { '@/lib/rapidCoinDatabase': db, '@/types/rapidCoin': types });
  const job = rapidFixture(1, { processing: 'ready', publication: 'uncertain', updatedAt: Date.now() - 181000, checkpoint: { listingId: 'listing', itemId: 'coin-1' }, ...patch.job });
  return { db, service, publication, job, writes: () => writes, run: () => service.reconcileRapidPublication({ client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', listingId: 'listing' }) };
}
test('old local lock recovers against exact saved coin with no claim or eBay ID; no remote mutation', async () => {
  const h = harness(); await h.db.createRapidJob(h.job);
  const result = await h.run(); assert.equal(result.released, true); assert.equal(result.blocked, false); assert.equal(h.writes(), 0);
  const recovered = await h.db.rapidJob(h.job.id); assert.equal(recovered.publication, 'draft_saved'); assert.equal(recovered.checkpoint.itemId, 'coin-1'); assert.equal(recovered.checkpoint.listingId, 'listing');
  assert.equal(await h.publication.rapidPublicationBlocked('seller', 'tenant', 'listing'), false);
});
test('recent unknown attempts cannot unlock even with an empty saved draft', async () => {
  const h = harness({ job: { updatedAt: Date.now() } }); await h.db.createRapidJob(h.job); assert.equal((await h.run()).blocked, true); assert.equal((await h.db.rapidJob(h.job.id)).publication, 'uncertain');
});
test('structured rejection is journalled but release still requires absent server claim and verified stock', async () => {
  for (const claim of [null, 'pending-server-claim']) {
    const h = harness({ row: { publish_claim_id: claim }, job: { publication: 'draft_saved' } }); await h.db.createRapidJob(h.job);
    await h.publication.beginRapidPublication('seller', 'tenant', 'listing'); await h.service.noteRapidPublishRejection('seller', 'tenant', 'listing', 'Complete required item specific: Material');
    assert.equal((await h.db.rapidJob(h.job.id)).publicationAttempt.outcome, 'rejected'); assert.equal((await h.run()).released, !claim);
  }
});
test('accepted identities, saved claims, published dates, terminal stock and sibling attempts stay blocked', async () => {
  for (const patch of [{ retained: '123456789012' }, { job: { externalId: '123456789012' } }, { row: { publish_claim_id: 'claim' } }, { row: { external_listing_id: '123456789012' } }, { row: { published_at: '2026-11-26T00:00:00Z' } }, { stock: { status: 'listed' } }, { stock: { status: undefined } }, { siblings: [{ id: 'other', status: 'draft', publish_claim_id: 'claim' }] }, { siblings: [{ id: 'other', status: 'active', external_listing_id: '123456789012' }] }]) {
    const h = harness(patch); await h.db.createRapidJob(h.job); assert.equal((await h.run()).blocked, true, JSON.stringify(patch)); assert.equal((await h.db.rapidJob(h.job.id)).publication, 'uncertain'); assert.equal(h.writes(), 0);
  }
});
test('failed reads, workspace changes and concurrent server claim cannot release a lock', async () => {
  for (const patch of [{ failed: true }, { scopeError: true }]) { const h = harness(patch); await h.db.createRapidJob(h.job); await assert.rejects(h.run()); assert.equal((await h.db.rapidJob(h.job.id)).publication, 'uncertain'); }
  const h = harness({ race: true }); await h.db.createRapidJob(h.job); assert.equal((await h.run()).blocked, true);
});
test('the response classifier never turns a timeout, accepted ID or reconciliation error into rejection', () => {
  const { confirmedPublishRejection: rejected } = loadRapidTypescript('src/lib/listingPublishOutcome.ts');
  assert.equal(rejected(422, { error: 'Complete required item specific: Material' }), true);
  for (const [status, body] of [[0, {}], [504, { error: 'Timed out' }], [409, { code: 'PUBLISH_RECONCILIATION_REQUIRED', error: 'Check claim' }], [422, { error: 'Error', accepted: true, externalListingId: '123456789012' }], [200, { success: false, error: 'No listing ID' }]]) assert.equal(rejected(status, body), false);
});
