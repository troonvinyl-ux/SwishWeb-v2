import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidFixture, rapidRecord, rapidText } from './lib/load-rapid-typescript.mjs';
const request = { captureRecord: rapidRecord, captureText: rapidText, assertCaptureScope: async () => {} };
const lead = loadRapidTypescript('src/lib/collectorEnvelopeLead.ts', { '@/lib/captureRequest': request });
const evidence = { transcription: 'Russia / 5 kopeks / 1759', transcriptionAvailable: true, fields: [{ name: 'country', value: 'Russia', source: 'collector', note: '' }, { name: 'denomination', value: '5 kopeks', source: 'collector', note: '' }], discrepancies: [] };
function harness({ listingId = null, publication = 'none', conflict = false } = {}) {
  let job = rapidFixture(1, { processing: 'needs_attention', publication, checkpoint: { itemId: 'coin-1', identification: { canonicalTitle: 'Unidentified coin', attributes: { country: 'Old visual guess' } }, ...(listingId ? { listingId } : {}) } }), writes = 0, patch;
  const stock = { id: 'coin-1', tenant_id: 'tenant', canonical_title: 'Seller-confirmed identity', updated_at: 'version', attributes: { _rapid_capture_id: 'coin-1', country: 'Seller correction', supplied_weight_g: 46.5, ebay_listing_media: ['coin-original'] } };
  const q = { select: () => q, eq: () => q, update: value => { writes++; patch = value; return q; }, single: async () => ({ data: stock, error: null }), maybeSingle: async () => ({ data: conflict ? null : { id: stock.id }, error: null }) };
  const client = { from: table => { assert.equal(table, 'items'); return q; }, rpc() { assert.fail('Envelope persistence must never create or publish a listing'); } };
  const service = loadRapidTypescript('src/lib/persistCollectorEnvelope.ts', { '@/lib/captureRequest': request, '@/lib/collectorEnvelopeLead': lead, '@/lib/captureDraftRecovery': { readOriginalCaptureDraft: async input => { assert.equal(input.itemId, 'coin-1'); return listingId; } }, '@/lib/rapidCoinDatabase': { changeRapidJob: async (_id, _scope, update) => { job = update(job); return job; } } });
  return { run: () => service.persistCollectorEnvelope({ client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins' }, job, { identification: { canonicalTitle: 'Russian 5 kopeks 1759', attributes: { country: 'AI Russia' } }, evidence }), job: () => job, patch: () => patch, writes: () => writes };
}
test('reread updates collector evidence on the same coin without overwriting seller fields or existing buyer copy', async () => {
  for (const listingId of [null, 'existing-draft']) {
    const h = harness({ listingId }); await h.run(); assert.equal(h.writes(), 1);
    assert.equal(h.patch().attributes.country, 'Seller correction'); assert.equal(h.patch().attributes.supplied_weight_g, 46.5); assert.equal(h.patch().canonical_title, undefined);
    assert.deepEqual(h.patch().attributes.ebay_listing_media, ['coin-original']); assert.equal(h.patch().attributes.collector_envelope.transcription, evidence.transcription);
    assert.equal(h.job().checkpoint.itemId, 'coin-1'); assert.equal(h.job().answers.numista_number, undefined);
    if (listingId) assert.equal(h.job().checkpoint.listingId, listingId);
  }
});
test('accepted or pending publication is never rewritten by envelope rereading', async () => {
  const h = harness({ publication: 'accepted_pending' }); await assert.rejects(h.run(), /existing publication/); assert.equal(h.writes(), 0);
});
test('optimistic conflicts stop local checkpoint changes without replaying a remote draft or publication', async () => {
  const h = harness({ conflict: true }); await assert.rejects(h.run(), /changed during/); assert.equal(h.job().evidence, undefined);
});
