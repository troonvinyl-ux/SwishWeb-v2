import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
import { studioFace } from './lib/coin-studio-fixtures.mjs';
globalThis.crypto ||= webcrypto;
const photoLib = loadRapidTypescript('src/lib/itemPhotos.ts'), contract = loadRapidTypescript('src/lib/coinStudioContract.ts', { '@/lib/itemPhotos': photoLib });
const service = loadRapidTypescript('src/lib/coinStudioPersistence.ts', { '@/lib/itemPhotos': photoLib, '@/lib/coinStudioContract': contract });
const originals = ['https://example.test/o.jpg', 'https://example.test/r.jpg'], faces = originals.map((url, i) => studioFace(url, i ? 'reverse' : 'obverse'));
function harness(attributes = {}, changed = false) {
  let item = { id: 'coin', tenant_id: 'tenant', specialist_id: 'coins', updated_at: 'version', media: [...originals], attributes: { seller_notes: 'Keep patina', ...attributes } }, writes = 0, filters = [];
  const client = { from: table => { assert.equal(table, 'items'); let patch; const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, abortSignal: () => q, update: value => { patch = value; return q; }, single: async () => ({ data: item, error: null }), maybeSingle: async () => { writes++; if (changed) return { data: null, error: null }; item = { ...item, ...patch }; return { data: { id: item.id }, error: null }; } }; return q; } };
  return { run: check => service.saveCoinStudioPair({ client, tenantId: 'tenant', itemId: 'coin', originals, faces, signal: new AbortController().signal, check: check || (async () => {}) }), item: () => item, writes: () => writes, filters };
}
test('both verified derivatives are merged atomically; media and collector/seller evidence remain original', async () => {
  const h = harness({ collector_envelope: 'Original handwritten note' }), item = await h.run();
  assert.deepEqual(item.media, originals); assert.equal(item.attributes.seller_notes, 'Keep patina'); assert.equal(item.attributes.collector_envelope, 'Original handwritten note');
  assert.deepEqual(item.attributes.ebay_listing_media, faces.map(face => face.enhancedUri)); assert.equal(Object.values(item.attributes._smart_studio_images).length, 2);
  assert.ok(h.filters.some(([key, value]) => key === 'tenant_id' && value === 'tenant')); assert.ok(h.filters.some(([key, value]) => key === 'updated_at' && value === 'version'));
});
test('explicit seller photo choices, including none, are never overwritten by background processing', async () => {
  for (const choice of [[], [originals[1]]]) { const h = harness({ ebay_listing_media: choice }); await h.run(); assert.deepEqual(h.item().attributes.ebay_listing_media, choice); }
});
test('scope changes and CAS conflicts cannot forge a successful association', async () => {
  const h = harness(); await assert.rejects(h.run(async () => { throw Error('Scope changed'); }), /Scope changed/); assert.equal(h.writes(), 0);
  await assert.rejects(harness({}, true).run(), /selection changed/);
});
