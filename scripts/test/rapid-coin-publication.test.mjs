import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript, rapidFixture } from './lib/load-rapid-typescript.mjs';
import { rapidMemoryIdb } from './lib/rapid-memory-idb.mjs';
function fixture() {
  const memory = rapidMemoryIdb(); globalThis.indexedDB = memory.api; globalThis.window = { dispatchEvent() {} };
  const db = loadRapidTypescript('src/lib/rapidCoinDatabase.ts'), types = loadRapidTypescript('src/types/rapidCoin.ts');
  const publication = loadRapidTypescript('src/lib/rapidCoinPublication.ts', { '@/lib/rapidCoinDatabase': db, '@/types/rapidCoin': types });
  return { db, publication };
}
test('simultaneous approvals journal exactly one original publication and refuse a second attempt', async () => {
  const h = fixture(), job = rapidFixture(1, { processing: 'ready', checkpoint: { itemId: 'coin-1', listingId: 'original-listing' } }); await h.db.createRapidJob(job);
  const results = await Promise.allSettled([h.publication.beginRapidPublication('seller', 'tenant', 'original-listing'), h.publication.beginRapidPublication('seller', 'tenant', 'original-listing')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await h.db.rapidJob(job.id)).publication, 'publishing');
});
test('accepted ItemID survives subsequent errors and cannot be replaced or downgraded by Save', async () => {
  const h = fixture(), job = rapidFixture(1, { processing: 'ready', checkpoint: { listingId: 'listing' } }); await h.db.createRapidJob(job);
  await h.publication.beginRapidPublication('seller', 'tenant', 'listing');
  await h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'accepted_pending', '123456789012');
  await h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'uncertain');
  await h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'draft_saved');
  const saved = await h.db.rapidJob(job.id); assert.equal(saved.externalId, '123456789012'); assert.equal(saved.publication, 'accepted_pending');
  assert.equal(await h.publication.rapidPublicationBlocked('seller', 'tenant', 'listing'), true);
  await assert.rejects(h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'published', '999999999999'));
  await h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'published', '123456789012');
  assert.equal((await h.db.rapidJob(job.id)).publication, 'published');
});
test('uncertain submissions remain blocked after local draft edits; another seller cannot change the job', async () => {
  const h = fixture(), job = rapidFixture(1, { processing: 'ready', checkpoint: { listingId: 'listing' } }); await h.db.createRapidJob(job);
  await h.publication.beginRapidPublication('seller', 'tenant', 'listing'); await h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'uncertain');
  await h.publication.recordRapidPublication('seller', 'tenant', 'listing', 'draft_saved');
  await assert.rejects(h.publication.beginRapidPublication('seller', 'tenant', 'listing'));
  await h.publication.recordRapidPublication('another', 'tenant', 'listing', 'published', '123456789012');
  assert.equal((await h.db.rapidJob(job.id)).publication, 'uncertain');
});
test('accepted item numbers survive a new module instance and are seller/tenant/listing scoped', () => {
  const store = new Map(); globalThis.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }; globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const first = loadRapidTypescript('src/lib/acceptedPublication.ts'); first.retainAcceptedPublication('seller:tenant:listing', '123456789012');
  const reloaded = loadRapidTypescript('src/lib/acceptedPublication.ts'); assert.equal(reloaded.readAcceptedPublication('seller:tenant:listing'), '123456789012'); assert.equal(reloaded.readAcceptedPublication('another:tenant:listing'), null);
  reloaded.clearAcceptedPublication('seller:tenant:listing'); assert.equal(reloaded.readAcceptedPublication('seller:tenant:listing'), null);
});
test('editor awaits the durable journal before sending eBay; acceptance precedes live readback', () => {
  const source = readFileSync('src/hooks/useListingEditorActions.ts', 'utf8'), journal = source.indexOf('await beginRapidPublication'), publish = source.indexOf("{ route: 'publish'");
  assert.ok(journal > 0 && journal < publish); assert.ok(source.indexOf("'accepted_pending', returnedId") < source.indexOf('let fresh = await readSubmissionListing'));
  assert.match(source, /recoverSharedPendingPublication/); assert.match(source, /stock\.data\.status/);
});
