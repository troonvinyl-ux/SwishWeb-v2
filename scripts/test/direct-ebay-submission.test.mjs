import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const base = { id: 'listing', item_id: 'stock', tenant_id: 'tenant', marketplace_id: 'ebay', title: 'Record Album', status: 'draft', external_listing_id: null, publish_claim_id: null, updated_at: 'v1' };
function harness(patch = {}, uploads = []) {
  let row = { ...base, ...patch }, onUpdate = null, providerError = null, recoveryError = null;
  const events = [], sends = [], updates = [], commits = [], feedback = [];
  const client = { from: table => { let mutation = null; const filters = []; return {
    select() { return this; }, eq(key, value) { filters.push(valueRow => valueRow[key] === value); return this; }, is(key, value) { filters.push(valueRow => value === null ? valueRow[key] == null : valueRow[key] === value); return this; },
    update(value) { mutation = value; return this; },
    single: async () => { const target = table === 'items' ? item : row; return { data: filters.every(filter => filter(target)) ? { ...target } : null, error: null }; },
    maybeSingle: async () => { onUpdate?.(); if (!filters.every(filter => filter(row))) return { data: null, error: null }; if (mutation) { updates.push(mutation); row = { ...row, ...mutation }; } return { data: { ...row }, error: null }; },
  }; } };
  class EdgeFunctionError extends Error { get displayMessage() { return this.message; } }
  const item = { id: 'stock', tenant_id: 'tenant', specialist_id: 'vinyl_records', updated_at: 'v1', condition: '', attributes: {} }, draft = { form: { ...row }, formRef: { current: { ...row } }, item: { ...item }, photos: ['https://fixture.invalid/front.jpg'], editRef: { current: 0 }, dirtyRef: { current: false }, commit: value => { commits.push(value); draft.formRef.current = { ...draft.formRef.current, ...value }; }, refresh: async () => {} };
  const stubs = {
    react: { useEffect: () => {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] }, sonner: { toast: { info: value => feedback.push(value), success: value => feedback.push(value), warning: value => feedback.push(value), error: value => feedback.push(value) } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    '@/lib/acceptedPublication': { readAcceptedPublication: () => null, retainAcceptedPublication: () => {}, clearAcceptedPublication: () => {} },
    '@/lib/supabase': { EdgeFunctionError, getSupabaseClientAsync: async () => client, callEdgeFunction: async (name, body) => { events.push('publish'); sends.push({ name, body }); return providerError ? { data: null, error: new EdgeFunctionError(providerError) } : { data: { success: true, externalListingId: '1234567890' }, error: null }; } },
    '@/lib/moduleScope': { activateModuleScope: async () => {} }, '@/lib/niche': { NICHE_SPECIALISTS: { tunes_flip: ['vinyl_records'] }, getActiveNicheId: () => 'coins' },
    '@/lib/listingStatusRecovery': { checkSharedListingStatus: async () => { if (recoveryError) throw new Error(recoveryError); return { ...row, status: 'active', external_listing_id: '1234567890' }; } }, '@/lib/scanToLiveTiming': { completeScanToLive: () => {} },
    '@/lib/listingEditorData': { hydrateListingEditor: listing => listing },
    '@/hooks/useListingEditorSave': { useListingEditorSave: () => ({ isPending: false, mutateAsync: async input => { events.push('save'); row = { ...row, ...input.form }; draft.dirtyRef.current = false; return { listing: { ...row }, item }; } }) },
  };
  const cache = new Map();
  function load(path) { if (cache.has(path)) return cache.get(path); const module = { exports: {} }, output = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true }); assert.equal(output.diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length || 0, 0, path); new Function('require', 'module', 'exports', output.outputText)(name => stubs[name] || load(`src/${name.slice(2)}.ts`), module, module.exports); cache.set(path, module.exports); return module.exports; }
  return { client, draft, events, sends, updates, commits, feedback, actions: load('src/hooks/useListingEditorActions.ts').useListingEditorActions(draft, 'user', 'tenant', uploads), prepare: load('src/lib/listingSubmission.ts').prepareSharedSubmission, setError: value => { providerError = value; }, setRecoveryError: value => { recoveryError = value; }, race: callback => { onUpdate = () => { row = callback(row); }; } };
}
test('submit saves dirty fields then invokes only the existing eBay publish function', async () => {
  const h = harness(); h.draft.dirtyRef.current = true; h.draft.formRef.current.category_id = '176985'; h.draft.formRef.current.condition = 'Good'; h.draft.formRef.current.condition_id = '5000';
  await h.actions.publish(); assert.deepEqual(h.events, ['save', 'publish']); assert.equal(h.sends[0].name, 'swish-ebay-list'); assert.equal(h.sends[0].body.categoryId, '176985'); assert.equal(h.sends[0].body.conditionId, '5000'); assert.equal(h.sends[0].body.nicheId, 'tunes_flip'); assert.equal(h.sends[0].body.listingId, 'listing');
});
test('old verified status is restored to a claimable draft, without touching operation claims', async () => {
  const h = harness({ status: 'verified' }); await h.actions.publish(); assert.deepEqual(h.updates, [{ status: 'draft' }]); assert.equal(h.sends.length, 1);
});
test('an existing publish claim blocks another request and remains untouched', async () => {
  const h = harness({ status: 'verified', publish_claim_id: 'server-claim' }); await h.actions.publish(); assert.equal(h.sends.length, 0); assert.deepEqual(h.updates, []); assert.match(h.feedback.join(' '), /Refresh status/);
});
test('recorded listings cannot be submitted again even when the browser started with stale draft data', async () => {
  const h = harness({ external_listing_id: '9876543210', status: 'active' }); await h.actions.publish(); assert.equal(h.sends.length, 0); assert.equal(h.actions.canPublish, false);
});
test('an explicit retry after rejection is not blocked by a persistent browser reservation', async () => {
  const h = harness(); h.setError('Complete required item specific: Artist'); await h.actions.publish(); await h.actions.publish(); assert.equal(h.sends.length, 2); assert.deepEqual(h.updates, []);
});
test('unchanged reopened draft publishes without a redundant save or false retention warning', async () => { const h = harness(); await h.actions.publish(); assert.deepEqual(h.events, ['publish']); assert.equal(h.sends.length, 1); });
test('previously saved uploads do not force an unnecessary second save', async () => {
  const h = harness({}, ['https://fixture.invalid/already-attached.jpg']);
  await h.actions.publish();
  assert.deepEqual(h.events, ['publish']);
});
test('an eBay acceptance is not presented as live until saved listing and stock reconciliation succeeds', async () => {
  const h = harness(); h.setRecoveryError('SWISH stock still has not moved to Live'); await h.actions.publish();
  assert.equal(h.sends.length, 1); assert.equal(h.commits.some(value => value.status === 'active'), false);
  assert.match(h.feedback.join(' '), /eBay accepted listing 1234567890/); assert.match(h.feedback.join(' '), /Do not submit again/);
});
test('stale stock version fails closed before any marketplace request', async () => { const h = harness(); h.draft.item.updated_at = 'older-stock-version'; await h.actions.publish(); assert.deepEqual(h.events, []); assert.equal(h.sends.length, 0); assert.match(h.feedback.join(' '), /changed since it was opened/); });
test('a stale listing version fails closed before eBay', async () => { const h = harness(); h.draft.formRef.current.updated_at = 'old-listing-version'; await h.actions.publish(); assert.deepEqual(h.events, []); assert.equal(h.sends.length, 0); });
test('review states are restored to draft without clearing claims or creating another listing', async () => { for (const status of ['review', 'review_required']) { const h = harness({ status }); await h.actions.publish(); assert.deepEqual(h.updates, [{ status: 'draft' }]); assert.equal(h.sends.length, 1); } });
test('rapid double click makes one provider call', async () => {
  const h = harness(); await Promise.all([h.actions.publish(), h.actions.publish()]); assert.equal(h.sends.length, 1);
});
test('concurrent server claim wins over verified-status restoration', async () => {
  const h = harness({ status: 'verified' }); h.race(row => ({ ...row, publish_claim_id: 'concurrent-claim' })); const result = await h.prepare(h.client, 'tenant', 'listing'); assert.equal(result.publish_claim_id, 'concurrent-claim'); assert.deepEqual(h.updates, []);
});
test('a concurrently recorded eBay ID is never overwritten or resent', async () => {
  const h = harness({ status: 'verified' }); h.race(row => ({ ...row, external_listing_id: '4444444444', status: 'active' })); await assert.rejects(() => h.prepare(h.client, 'tenant', 'listing')); assert.equal(h.sends.length, 0); assert.deepEqual(h.updates, []);
});
test('pending submissions do not have their listing content changed', async () => {
  const h = harness({ publish_claim_id: 'pending-claim' }); h.draft.dirtyRef.current = true; await h.actions.publish(); assert.deepEqual(h.events, []); assert.deepEqual(h.updates, []);
});
