import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
function harness() {
  const notices = [], calls = [];
  const form = { category_id: '360', category: 'Art Prints', condition_id: '3000', item_specifics: { Artist: 'Unknown' }, title: 'Italian coin', description: 'Visible wear.', price: 23.25, condition_description: 'Scratches and irregular rim.' };
  const draft = { form, formRef: { current: form }, item: { specialist_id: 'coins', attributes: {} }, revisionRef: { current: 'initial' }, change: (key, value) => { form[key] = value; draft.revisionRef.current += ':' + key; } };
  const hook = loadRapidTypescript('src/hooks/useListingCategorySuggestion.ts', {
    react: { useState: initial => [initial, () => {}] }, sonner: { toast: { success: value => notices.push(value), error: value => notices.push(value) } },
    '@/lib/supabase': { getSupabaseClientAsync: async () => ({}) }, '@/lib/niche': { getActiveNicheId: () => 'coins' },
    '@/lib/listingSubmission': { listingNicheId: () => 'coins' }, '@/lib/itemPhotos': { asRecord: rapidRecord },
    '@/lib/scopedCategoryLookup': { lookupScopedListingCategory: async input => { calls.push(input); assert.equal(input.isCurrent(), true); return { id: '123456', name: 'Italy', categoryPath: 'Coins > European > Italy' }; } },
  }).useListingCategorySuggestion(draft, 'seller', 'tenant');
  return { hook, form, notices, calls };
}
test('Find eBay category replaces Art Prints and resets only category-specific requirements', async () => {
  const h = harness(); await h.hook.suggest();
  assert.equal(h.form.category, 'Italy'); assert.equal(h.form.category_id, '123456'); assert.equal(h.form.category_path, 'Coins > European > Italy');
  assert.equal(h.form.condition_id, ''); assert.deepEqual(h.form.item_specifics, {});
  assert.equal(h.form.title, 'Italian coin'); assert.equal(h.form.price, 23.25); assert.equal(h.form.description, 'Visible wear.'); assert.equal(h.form.condition_description, 'Scratches and irregular rim.');
  assert.equal(h.calls[0].specialistId, 'coins'); assert.match(h.notices.join(' '), /condition and required specifics/);
});
test('an unchanged verified category does not erase seller specifics or condition', async () => {
  const h = harness(); h.form.category_id = '123456'; h.form.item_specifics = { Denomination: '5 Grana' }; await h.hook.suggest();
  assert.equal(h.form.condition_id, '3000'); assert.deepEqual(h.form.item_specifics, { Denomination: '5 Grana' });
});
test('editor marks invalid selections, suppresses art metadata and guards publication before a queue attempt', () => {
  const editor = readFileSync('src/pages/ListingEditor.tsx', 'utf8'), actions = readFileSync('src/hooks/useListingEditorActions.ts', 'utf8');
  assert.match(editor, /categoryError=\{categoryIssue\}/); assert.match(editor, /categoryIssue \? '' : categoryId/);
  assert.ok(actions.indexOf('if (categoryIssue) throw new Error(categoryIssue)') < actions.indexOf('if (rapid) rapidAttempted = await beginRapidPublication'));
  assert.match(actions, /!publicationBlock\(draft.form\) && !categoryIssue/);
  const metadata = readFileSync('src/lib/listingEditorMetadata.ts', 'utf8'); assert.match(metadata, /ebay_category_path/);
  const capture = readFileSync('src/lib/quickCaptureFlow.ts', 'utf8'); assert.match(capture, /discardGeneratedCoinCategory\(generated\)/);
});
