import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { loadRapidTypescript, rapidFixture } from './lib/load-rapid-typescript.mjs';
import { rapidMemoryIdb } from './lib/rapid-memory-idb.mjs';
function fixture() {
  const memory = rapidMemoryIdb(); globalThis.indexedDB = memory.api; globalThis.window = { dispatchEvent() {} }; globalThis.File = File;
  const db = loadRapidTypescript('src/lib/rapidCoinDatabase.ts');
  const claims = loadRapidTypescript('src/lib/rapidCoinClaims.ts', { '@/lib/rapidCoinDatabase': db });
  return { db, claims, memory };
}
test('fifty coins remain durable; browser-wide processing is limited to two distinct claims', async () => {
  const h = fixture();
  for (let i = 1; i <= 50; i++) await h.db.createRapidJob(rapidFixture(i));
  const claims = await Promise.all(Array.from({ length: 10 }, (_, index) => h.claims.claimRapidJob('seller:tenant', `tab-${index}`)));
  assert.equal(claims.filter(Boolean).length, 2); assert.equal(new Set(claims.filter(Boolean).map(job => job.id)).size, 2);
  const rows = await h.db.rapidJobs('seller:tenant'); assert.equal(rows.length, 50); assert.equal(rows.filter(row => row.processing === 'processing').length, 2);
  assert.equal((await h.db.rapidJobs('another:tenant')).length, 0);
});
test('expired processing resumes the original item/draft checkpoints, not a new physical record', async () => {
  const h = fixture(), job = rapidFixture(1, { processing: 'processing', checkpoint: { itemId: 'original-item', listingId: 'original-draft', draftAttempted: true }, lease: { owner: 'crashed', until: 1 } });
  await h.db.createRapidJob(job); const resumed = await h.claims.claimRapidJob(job.scope, 'new-tab');
  assert.equal(resumed.id, job.id); assert.deepEqual(resumed.checkpoint, job.checkpoint);
  assert.equal(await h.claims.renewRapidClaim(job.id, job.scope, 'crashed'), false); assert.equal(await h.claims.renewRapidClaim(job.id, job.scope, 'new-tab'), true);
});
test('original blobs are committed atomically and reload with their original byte content', async () => {
  const h = fixture(), job = rapidFixture(1, { enqueued: false, photos: [] }), file = new File(['unaltered coin photo'], 'obverse.jpg', { type: 'image/jpeg' });
  await h.db.createRapidJob(job); await h.db.retainRapidPhoto(job.id, job.scope, { id: 'o', slotId: 'obverse', label: 'Obverse', role: 'coin', name: file.name, type: file.type }, file);
  const restored = await h.db.rapidJob(job.id), image = await h.db.rapidPhotoFile(restored, 'o');
  assert.equal(await image.text(), await file.text()); assert.equal(image.name, file.name);
  await assert.rejects(h.db.retainRapidPhoto(job.id, 'other:tenant', { id: 'bad', slotId: 'reverse' }, file));
  assert.equal((await h.db.rapidJob(job.id)).photos.length, 1);
  await h.db.changeRapidJob(job.id, job.scope, row => ({ ...row, enqueued: true }));
  await assert.rejects(h.db.retainRapidPhoto(job.id, job.scope, { id: 'bad', slotId: 'reverse' }, file));
  assert.equal((await h.db.rapidJob(job.id)).photos.length, 1);
});
test('publication states never enter the preparation worker or get automatically replayed', async () => {
  const h = fixture();
  for (const [i, publication] of ['publishing', 'uncertain', 'accepted_pending', 'published'].entries()) await h.db.createRapidJob(rapidFixture(i + 1, { publication }));
  assert.equal(await h.claims.claimRapidJob('seller:tenant', 'tab'), null);
});
