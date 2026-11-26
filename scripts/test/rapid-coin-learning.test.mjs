import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidFixture } from './lib/load-rapid-typescript.mjs';
import { webcrypto } from 'node:crypto';
globalThis.crypto ||= webcrypto;
test('only explicit seller-confirmed corrections reach the existing feedback table, with a stable retry ID', async () => {
  let job = rapidFixture(1, { checkpoint: { itemId: 'coin-1', identification: { canonicalTitle: 'AI suggestion', confidence: .2, attributes: {} } }, draft: { title: 'Coin', photos: ['https://fixture.invalid/obverse.jpg'] } }), inserts = 0, saved = null;
  const client = { from: table => { assert.equal(table, 'ai_id_feedback'); const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: saved, error: null }), insert: row => { inserts++; saved = row; return { select: () => ({ single: async () => ({ data: { id: row.id }, error: null }) }) }; } }; return q; } };
  const learning = loadRapidTypescript('src/lib/rapidCoinLearning.ts', { '@/lib/captureRequest': { assertCaptureScope: async () => {} }, '@/lib/rapidCoinDatabase': { rapidJob: async () => job, changeRapidJob: async (id, scope, update) => { assert.equal(id, job.id); assert.equal(scope, job.scope); job = update(job); return job; } } });
  const scope = { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', isCurrent: () => true }, original = job;
  await assert.rejects(learning.recordRapidCoinCorrection(scope, job, '', 'Unverified AI guess'));
  await learning.recordRapidCoinCorrection(scope, original, 'Seller-confirmed Roman coin', 'Checked the actual inscription and catalogue');
  await learning.recordRapidCoinCorrection(scope, original, 'Seller-confirmed Roman coin', 'Checked the actual inscription and catalogue');
  assert.equal(inserts, 1); assert.equal(saved.feedback, 'partial'); assert.equal(saved.original_attributes.seller_confirmed, true); assert.equal(saved.item_id, 'coin-1'); assert.equal(saved.ai_canonical_title, 'AI suggestion');
  await assert.rejects(learning.recordRapidCoinCorrection({ ...scope, userId: 'other' }, job, 'Other identity', 'Other notes'), /another seller/);
});
