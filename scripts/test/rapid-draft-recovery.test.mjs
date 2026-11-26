import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord, rapidText, rapidFixture } from './lib/load-rapid-typescript.mjs';
const request = loadRapidTypescript('src/lib/captureRequest.ts', { '@/lib/supabase': {}, '@/lib/moduleScope': { verifyModuleScope: async () => {} } });
const read = loadRapidTypescript('src/lib/captureDraftRecovery.ts', { '@/lib/captureRequest': request });
function harness({ rows = [], failure, stockPatch = {}, jobPatch = {} } = {}) {
  let job = rapidFixture(1, { processing: 'needs_attention', checkpoint: { itemId: 'coin-1', draftAttempted: true, generated: { title: 'Coin' }, ...(failure ? { draftFailure: failure } : {}) }, ...jobPatch }), changes = 0;
  const stock = { id: 'coin-1', tenant_id: 'tenant', specialist_id: 'coins', status: 'review', attributes: { _rapid_capture_id: 'coin-1' }, ...stockPatch };
  const filters = [];
  const client = { rpc() { assert.fail('Recovery must never create a draft or publish'); }, from: table => {
    const q = { select: () => q, eq: (key, value) => { filters.push([table, key, value]); return q; }, order: () => q, limit: () => q, maybeSingle: async () => ({ data: stock, error: null }), then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject), update() { assert.fail('No remote data writes during recovery'); } }; return q;
  } };
  const service = loadRapidTypescript('src/lib/rapidDraftRecovery.ts', { '@/lib/captureRequest': request, '@/lib/captureDraftRecovery': read, '@/lib/rapidCoinDatabase': { changeRapidJob: async (_id, scope, change) => { assert.equal(scope, job.scope); job = change(job); changes++; return job; } } });
  const scope = { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', isCurrent: () => true };
  return { run: () => service.recoverRapidDraft(scope, job), job: () => job, changes: () => changes, filters, scope };
}
const draft = { id: 'draft', item_id: 'coin-1', tenant_id: 'tenant', status: 'draft' };
test('lost-response draft found for the exact saved coin resumes without creating another', async () => {
  const h = harness({ rows: [draft] }), result = await h.run();
  assert.equal(result.resumed, true); assert.equal(h.job().checkpoint.listingId, 'draft'); assert.equal(h.job().processing, 'captured');
  assert.equal(h.job().photos.length, 3); assert.ok(h.filters.some(([table, key, value]) => table === 'listings' && key === 'item_id' && value === 'coin-1'));
});
test('explicit transactional rejection permits a user-initiated same-item preparation retry', async () => {
  const h = harness({ failure: { outcome: 'rejected', code: '23514', message: 'Check constraint rejected' } });
  assert.equal((await h.run()).resumed, true); assert.equal(h.job().checkpoint.draftAttempted, false);
  assert.equal(h.job().checkpoint.generated, undefined); assert.equal(h.job().checkpoint.itemId, 'coin-1');
});
test('legacy unknown and network/timeout outcomes remain protected when no draft is found', async () => {
  for (const failure of [undefined, { outcome: 'uncertain', code: '', message: 'Lost response' }, { outcome: 'rejected', code: '57014', message: 'Timeout' }]) {
    const h = harness({ failure }); assert.equal((await h.run()).resumed, false); assert.equal(h.changes(), 0);
  }
});
test('a hidden older accepted sibling or pending claim blocks recovery even with a newer draft', async () => {
  for (const extra of [{ ...draft, id: 'older', status: 'active', external_listing_id: '123456789' }, { ...draft, id: 'older', publish_claim_id: 'claim' }]) {
    const h = harness({ rows: [draft, extra] }); await assert.rejects(h.run(), /submission|marketplace/); assert.equal(h.changes(), 0);
  }
});
test('two saved drafts are not silently selected and unrelated stock cannot be linked', async () => {
  const many = harness({ rows: [draft, { ...draft, id: 'second' }] }); await assert.rejects(many.run(), /More than one/);
  const wrong = harness({ stockPatch: { attributes: { _rapid_capture_id: 'other' } } }); await assert.rejects(wrong.run(), /does not match/); assert.equal(wrong.changes(), 0);
});
test('seller switches, active workers and already-started publishing refuse local repair', async () => {
  for (const jobPatch of [{ userId: 'another' }, { processing: 'processing' }, { publication: 'uncertain' }, { publicationAttempt: { outcome: 'pending' } }]) {
    const h = harness({ jobPatch }); await assert.rejects(h.run()); assert.equal(h.changes(), 0);
  }
  const h = harness(); h.scope.isCurrent = () => false; await assert.rejects(h.run(), /workspace changed/);
});
test('only explicit PostgreSQL rejection codes permit retry; HTTP, timeouts and generic errors do not', () => {
  for (const code of ['23514', '23503', '22003', 'P0001', '42501']) assert.equal(request.draftRejectionCode({ code }), code);
  for (const code of ['', '57014', '08006', '40001', 'PGRST000', '500']) assert.equal(request.draftRejectionCode({ code }), null);
  assert.equal(request.draftRejectionCode(new Error('HTTP 400')), null);
});
