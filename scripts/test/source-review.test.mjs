import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySourceReview } from '../lib/source-review.mjs';
import { workflowImpact } from '../lib/source-impact.mjs';
const sha = 'a'.repeat(40);
const source = { repository: 'troonvinyl-ux/SWISH', branch: 'main', commit: sha, backendUrl: 'https://iwgaqieyoahmcjfziwga.backend.onspace.ai', contracts: { app: sha }, review: { status: 'approved', reviewUrl: 'https://github.com/troonvinyl-ux/SwishWeb/pull/7' } };
function reader({ merged = true, author = 'contributor', reviewSha = sha, state = 'APPROVED', baseline = source, followup = [] } = {}) {
  return async (repository, path) => {
    assert.equal(repository, 'troonvinyl-ux/SwishWeb');
    if (path.includes('/reviews?')) return [{ user: { login: 'troonvinyl-ux' }, state, commit_id: reviewSha }, ...followup];
    if (path.startsWith('contents/')) return { encoding: 'base64', content: Buffer.from(JSON.stringify(baseline)).toString('base64') };
    return { merged, user: { login: author }, base: { ref: 'main', repo: { full_name: repository } }, head: { sha } };
  };
}
test('approved label alone does not establish a merged, owner-reviewed source baseline', async () => {
  assert.deepEqual(await verifySourceReview(source, reader()), []);
  for (const options of [{ merged: false }, { author: 'troonvinyl-ux' }, { reviewSha: 'b'.repeat(40) }, { state: 'DISMISSED' }, { state: 'CHANGES_REQUESTED' }, { baseline: { ...source, commit: 'c'.repeat(40) } }]) assert.ok((await verifySourceReview(source, reader(options))).length);
});
test('a later comment does not withdraw approval, but a dismissed review does', async () => {
  assert.deepEqual(await verifySourceReview(source, reader({ followup: [{ user: { login: 'troonvinyl-ux' }, state: 'COMMENTED', commit_id: sha }] })), []);
  assert.ok((await verifySourceReview(source, reader({ followup: [{ user: { login: 'troonvinyl-ux' }, state: 'DISMISSED', commit_id: sha }] }))).length);
});
test('pending baseline avoids any claim of approval', async () => assert.ok((await verifySourceReview({ ...source, review: { status: 'pending' } }, () => assert.fail('No GitHub request required'))).length));
test('GitHub source access failure propagates and cannot produce approval', async () => assert.rejects(() => verifySourceReview(source, async () => { throw new Error('HTTP 403'); })));
test('whole tree changes conservatively map to corresponding web workflows', () => {
  const impacts = workflowImpact([{ path: 'supabase' }, { path: 'components' }]);
  for (const id of ['capture', 'listings', 'marketplace', 'billing']) assert.ok(impacts.some(flow => flow.id === id));
  assert.ok(workflowImpact([], [{ filename: 'services/authSessionRecoveryService.ts' }]).some(flow => flow.id === 'accounts'));
  assert.ok(workflowImpact([{ path: 'assets' }]).some(flow => flow.id === 'release'));
});
