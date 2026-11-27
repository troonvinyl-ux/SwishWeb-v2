import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
const coinContext = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts', { '@/lib/coinCategoryPolicy': policy, '@/lib/coinCategoryContext': coinContext, '@/lib/itemPhotos': { asRecord: rapidRecord } });
function harness(categoryId = '360', claim = null, categoryPatch = {}) {
  let sends = 0, attempts = 0, saves = 0;
  const notices = [], row = { id: 'listing', item_id: 'coin', tenant_id: 'tenant', status: 'draft', marketplace_id: 'ebay', category_id: categoryId, category: 'Art Prints', publish_claim_id: claim, ...categoryPatch };
  const draft = { form: row, formRef: { current: row }, item: { id: 'coin', tenant_id: 'tenant', specialist_id: 'coins', attributes: { _rapid_capture_id: 'coin' } }, photos: ['https://fixture.invalid/coin.jpg'], editRef: { current: 0 }, dirtyRef: { current: false }, commit() {}, refresh: async () => {} };
  const q = { select() { return this; }, eq() { return this; }, then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); } };
  const client = { from: () => q };
  class EdgeFunctionError extends Error { get displayMessage() { return this.message; } }
  const actions = loadRapidTypescript('src/hooks/useListingEditorActions.ts', {
    react: { useState: initial => [initial, () => {}], useRef: value => ({ current: value }), useEffect() {} },
    sonner: { toast: { info: value => notices.push(value), error: value => notices.push(value), success() {}, warning() {} } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    '@/lib/supabase': { EdgeFunctionError, getSupabaseClientAsync: async () => client, callEdgeFunction: async () => { sends++; throw Error('Must not send a publish request'); } },
    '@/lib/moduleScope': { activateModuleScope: async () => {} }, '@/lib/listingReadiness': { publicationBlock: () => null },
    '@/lib/listingStatusRecovery': {}, '@/lib/acceptedPublication': { readAcceptedPublication: () => null },
    '@/lib/listingClarification': { listingClarification: () => ({ target: 'specifics' }) },
    '@/lib/listingSubmission': { listingNicheId: () => 'coins', readSubmissionListing: async () => row, prepareSharedSubmission: async () => { throw Error('Category must be checked first'); } },
    '@/lib/listingCoinCategory': guard, '@/lib/scanToLiveTiming': {}, '@/lib/listingEditorData': {},
    '@/lib/inventoryLifecycle': { hasLiveSibling: () => false }, '@/lib/itemPhotos': { asRecord: rapidRecord },
    '@/lib/rapidCoinPublication': { rapidPublicationBlocked: async () => false, beginRapidPublication: async () => { attempts++; return true; }, recordRapidPublication: async () => { throw Error('Invalid category must not change publication journal'); } },
    '@/lib/rapidPublicationRecovery': {}, '@/lib/listingPublishOutcome': {},
    '@/hooks/useListingEditorSave': { useListingEditorSave: () => ({ isPending: false, mutateAsync: async () => { saves++; throw Error('Invalid category must not be saved'); } }) },
  }).useListingEditorActions(draft, 'seller', 'tenant', []);
  return { actions, notices, sends: () => sends, attempts: () => attempts, saves: () => saves };
}
test('Art Prints is stopped before a rapid attempt, eBay request or editor save', async () => {
  const h = harness(); assert.equal(h.actions.canPublish, false); assert.match(h.actions.reason, /Find eBay category/);
  assert.equal(await h.actions.publish(), false); assert.equal(h.sends(), 0); assert.equal(h.attempts(), 0); assert.equal(h.saves(), 0);
  assert.match(h.notices.join(' '), /Art Prints/);
});
test('the reported Coins > Coins > Publications category is stopped before saving or submitting a physical coin', async () => {
  const h = harness('994001', null, { title: 'British India Pice 1204', category: 'Publications', category_path: 'Coins > Coins > Publications' });
  assert.equal(h.actions.canPublish, false); assert.match(h.actions.reason, /Publications/);
  assert.equal(await h.actions.publish(), false); assert.equal(h.sends(), 0); assert.equal(h.attempts(), 0); assert.equal(h.saves(), 0);
});
test('single Roman coin in Collections/Bulk Lots is blocked before save, queue attempt or publish', async () => {
  const h = harness('3410', null, { title: 'Provisional: Roman Imperial Augustus As', quantity: 1, category: 'Collections/Bulk Lots', category_path: 'Coins > Coins > Collections/Bulk Lots' });
  assert.equal(h.actions.canPublish, false); assert.match(h.actions.reason, /single coin/);
  assert.equal(await h.actions.publish(), false); assert.equal(h.sends(), 0); assert.equal(h.attempts(), 0); assert.equal(h.saves(), 0);
});
test('single ancient coin cannot publish through a modern-country category', async () => {
  const h = harness('123456', null, { title: 'Roman Imperial Augustus As', category: 'Italy', category_path: 'Coins > Coins > European > Italy' });
  assert.equal(await h.actions.publish(), false); assert.equal(h.sends(), 0); assert.equal(h.attempts(), 0); assert.match(h.notices.join(' '), /ancient-coin branch/);
});
test('missing and malformed category IDs request a live category rather than guessing one', async () => {
  for (const id of ['', 'AI-category']) { const h = harness(id); assert.equal(await h.actions.publish(), false); assert.equal(h.sends(), 0); assert.equal(h.attempts(), 0); assert.match(h.notices.join(' '), /Find a relevant eBay coin category/); }
});
test('a retained server claim remains protected regardless of category correction', async () => {
  const h = harness('360', 'original-claim'); assert.equal(await h.actions.publish(), false); assert.equal(h.sends(), 0); assert.equal(h.attempts(), 0);
  assert.match(h.notices.join(' '), /Refresh status/);
});
