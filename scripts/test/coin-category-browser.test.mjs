import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const ID = '997104'; // Synthetic test leaf, never a production default.
const indian = { id: ID, name: 'Indian', categoryPath: 'Coins > British > Indian', isLeaf: true };
function harness() {
  const calls = [], selections = [], notices = [];
  let queryOptions, mutationOptions, current = true;
  const input = { userId: 'seller', tenantId: 'tenant', nicheId: 'coins', specialistId: 'coins', identity: 'original-draft', revision: 'v1', title: 'British India Pice 1204', attributes: { country: 'British India', year: '1204' }, disabled: false, isCurrent: () => current, onSelect: value => selections.push(value) };
  const invoke = async (endpoint, body) => {
    calls.push({ endpoint, ...body });
    return { data: body.route === 'get_category_children' ? { children: [{ id: '997101', name: 'Coins', isLeaf: false }] } : { isLeaf: true, categoryId: body.categoryId, marketplaceId: 'EBAY_GB', aspects: [] }, error: null };
  };
  const { useListingCategoryBrowser } = loadRapidTypescript('src/hooks/useListingCategoryBrowser.ts', {
    react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: effect => effect() },
    '@tanstack/react-query': { useQuery: options => { queryOptions = options; return { data: undefined, error: null, isFetching: false, refetch: async () => {} }; }, useMutation: options => { mutationOptions = options; return { error: null, isPending: false, reset() {}, mutate() {} }; } },
    sonner: { toast: { error: message => notices.push(message) } },
    '@/lib/supabase': { getSupabaseClientAsync: async () => ({}) },
    '@/lib/scopedCategoryLookup': { scopedCategoryInvoker: value => { assert.equal(value.tenantId, 'tenant'); assert.equal(value.nicheId, 'coins'); return invoke; } },
  });
  const flow = useListingCategoryBrowser(input);
  return { flow, calls, selections, notices, input, query: () => queryOptions, mutation: () => mutationOptions, stale: () => { current = false; } };
}
test('category browsing is opt-in, scoped and uses the native tree route', async () => {
  const h = harness(); assert.equal(h.query().enabled, false);
  const rows = await h.query().queryFn();
  assert.equal(rows[0].name, 'Coins');
  assert.equal(h.calls[0].route, 'get_category_children'); assert.equal(h.calls[0].parentId, '0');
  assert.equal(h.selections.length, 0);
});
test('a chosen leaf is verified before its ID/name/path enter the existing local draft', async () => {
  const h = harness(), result = await h.mutation().mutationFn(indian);
  assert.equal(h.selections.length, 0);
  h.mutation().onSuccess(result);
  assert.deepEqual(h.selections, [{ id: ID, name: 'Indian', categoryPath: indian.categoryPath }]);
  assert.deepEqual(h.calls.map(call => call.route), ['get_category_aspects']);
  assert.equal(h.calls[0].forceLive, true);
});
test('browser cannot select the rejected Publications ID, even if its label is misleading', async () => {
  const h = harness();
  await assert.rejects(h.mutation().mutationFn({ ...indian, id: '548' }), /Publications/);
  assert.equal(h.selections.length, 0);
});
test('stale editor scopes and publication-disabled browsers cannot apply a selection', async () => {
  const h = harness(), result = await h.mutation().mutationFn(indian); h.stale();
  h.mutation().onSuccess(result); assert.equal(h.selections.length, 0);
  const disabled = harness(); disabled.input.disabled = true;
  await assert.rejects(disabled.mutation().mutationFn(indian), /workspace/);
  assert.equal(disabled.calls.length, 0); assert.equal(disabled.selections.length, 0);
});
test('expected API failures are visible and never reported as a successful category selection', () => {
  const h = harness(); h.mutation().onError(new Error('eBay category service unavailable'));
  assert.match(h.notices[0], /service unavailable/); assert.equal(h.selections.length, 0);
});
