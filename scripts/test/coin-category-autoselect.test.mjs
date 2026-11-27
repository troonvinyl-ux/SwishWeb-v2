import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
function harness(overrides = {}) {
  const calls = [], ref = { current: '' };
  const draft = { loading: false, dirty: false, form: { id: 'draft', title: 'Russian 5 kopeks 1759', category_id: '' }, item: { id: 'coin', attributes: { collector_envelope: { transcription: 'Russia / 5 kopeks / 1759' } } }, ...overrides };
  const hook = loadRapidTypescript('src/hooks/useCoinCategoryAutoselect.ts', { react: { useRef: () => ref, useEffect: effect => effect() }, '@/lib/listingSubmission': { listingNicheId: () => 'coins' }, '@/lib/listingCoinCategory': { coinListingCategoryIssue: form => form.category_id === 'valid' ? null : 'Needs relevant category' }, '@/lib/listingReadiness': { publicationBlock: form => form.publish_claim_id ? 'Original claim' : null } });
  return { calls, run: () => hook.useCoinCategoryAutoselect(draft, 'seller', 'tenant', false, async auto => { calls.push(auto); }), draft };
}
test('a clean recorded Russian coin attempts category preselection once, without a save or publication', () => {
  const h = harness(); h.run(); h.run(); assert.deepEqual(h.calls, [true]);
});
test('a clean British India draft automatically requests a category once without requiring a Numista reference', () => {
  const h = harness({ item: { id: 'coin', attributes: { country: 'British India', year: '1204', denomination: 'PICE' } }, form: { id: 'draft', title: 'British India Pice 1204', category_id: '' } });
  h.run(); h.run(); assert.deepEqual(h.calls, [true]);
});
test('dirty drafts, existing valid categories and pending publication claims are not auto-rewritten', () => {
  for (const changes of [{ dirty: true }, { form: { id: 'draft', category_id: 'valid' } }, { form: { id: 'draft', publish_claim_id: 'claim' } }]) {
    const h = harness(changes); h.run(); assert.deepEqual(h.calls, []);
  }
});
test('a missing issuing country does not force a Russian or British category', () => {
  const h = harness({ item: { id: 'coin', attributes: {} }, form: { id: 'draft', title: 'Unidentified coin', category_id: '' } }); h.run(); assert.deepEqual(h.calls, []);
});
