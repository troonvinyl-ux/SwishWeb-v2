import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
const { hydrateListingEditor } = loadRapidTypescript('src/lib/listingEditorData.ts', { '@/lib/itemPhotos': { asRecord: rapidRecord }, '@/lib/ebayMusicContract': { ebayConditionId: () => '', EBAY_MUSIC_CONDITIONS: [] } });
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts', { '@/lib/coinCategoryPolicy': policy, '@/lib/coinCategoryContext': context, '@/lib/itemPhotos': { asRecord: rapidRecord } });
const title = 'Roman Imperial Augustus As';
const categoryPath = 'Coins > Coins > Ancient > Roman Imperial';
const stock = { id: 'coin', tenant_id: 'tenant', specialist_id: 'coins', attributes: { ebay_category_id: '3410', ebay_category_name: 'Collections/Bulk Lots', ebay_category_path: 'Coins > Coins > Collections/Bulk Lots', ebay_condition_id: '', ebay_item_specifics: [] } };
test('authoritative replacement ID is never presented using an old bulk-lot label or path', () => {
  const listing = { id: 'listing', item_id: 'coin', title, category_id: '910002', category: 'Roman Imperial', category_path: categoryPath };
  const form = hydrateListingEditor(listing, stock);
  assert.equal(form.category_id, '910002'); assert.equal(form.category, 'Roman Imperial'); assert.equal(form.category_path, categoryPath);
  assert.equal(guard.coinListingCategoryIssue(form, stock), null);
});
test('missing metadata for a replacement ID does not reuse or certify the old selection', () => {
  const form = hydrateListingEditor({ id: 'listing', title, category_id: '910002' }, stock);
  assert.equal(form.category, ''); assert.equal(form.category_path, ''); assert.match(guard.coinListingCategoryIssue(form, stock), /Find eBay category/);
});
test('old bulk-lot draft remains visible but is not treated as publishable', () => {
  const form = hydrateListingEditor({ id: 'listing', title, category_id: '3410' }, stock);
  assert.equal(form.category, 'Collections/Bulk Lots'); assert.match(guard.coinListingCategoryIssue(form, stock), /single coin/);
});
test('a failed live lookup preserves the same draft and does not silently clear or replace its category', async () => {
  const form = { id: 'listing', title, category_id: '3410', category: 'Collections/Bulk Lots', condition_id: '', item_specifics: {}, price: 70 };
  const original = structuredClone(form), notices = [];
  const draft = { form, formRef: { current: form }, item: stock, revisionRef: { current: 'first' }, change: () => assert.fail('No category mutation on lookup failure') };
  const { useListingCategorySuggestion } = loadRapidTypescript('src/hooks/useListingCategorySuggestion.ts', {
    react: { useState: value => [value, () => {}] }, sonner: { toast: { success: () => assert.fail('No successful selection'), error: value => notices.push(value) } },
    '@/lib/supabase': { getSupabaseClientAsync: async () => ({}) }, '@/lib/niche': { getActiveNicheId: () => 'coins' }, '@/lib/listingSubmission': { listingNicheId: () => 'coins' }, '@/lib/itemPhotos': { asRecord: rapidRecord },
    '@/lib/scopedCategoryLookup': { lookupScopedListingCategory: async () => { throw new Error('No relevant ancient coin category returned'); } },
  });
  await useListingCategorySuggestion(draft, 'seller', 'tenant').suggest();
  assert.deepEqual(form, original); assert.match(notices.join(' '), /ancient coin category/);
});
test('a replacement preserves seller title, notes and pricing and resets only category-specific fields', async () => {
  const form = { id: 'listing', title, description: 'Genuine wear and irregular flan.', price: 70, quantity: 1, condition_description: 'Corrosion and edge loss.', category_id: '3410', category: 'Collections/Bulk Lots', condition_id: '3000', item_specifics: { Number: 'Many' } };
  const draft = { form, formRef: { current: form }, item: stock, revisionRef: { current: 'first' }, change: (key, value) => { form[key] = value; draft.revisionRef.current += key; } };
  const notices = [];
  const { useListingCategorySuggestion } = loadRapidTypescript('src/hooks/useListingCategorySuggestion.ts', {
    react: { useState: value => [value, () => {}] }, sonner: { toast: { success: value => notices.push(value), error: value => notices.push(value) } },
    '@/lib/supabase': { getSupabaseClientAsync: async () => ({}) }, '@/lib/niche': { getActiveNicheId: () => 'coins' }, '@/lib/listingSubmission': { listingNicheId: () => 'coins' }, '@/lib/itemPhotos': { asRecord: rapidRecord },
    '@/lib/scopedCategoryLookup': { lookupScopedListingCategory: async input => { assert.equal(input.title, title); return { id: '910002', name: 'Roman Imperial', categoryPath }; } },
  });
  await useListingCategorySuggestion(draft, 'seller', 'tenant').suggest();
  assert.equal(form.category_id, '910002'); assert.equal(form.category_path, categoryPath); assert.equal(form.condition_id, ''); assert.deepEqual(form.item_specifics, {});
  assert.equal(form.title, title); assert.equal(form.price, 70); assert.equal(form.quantity, 1); assert.equal(form.description, 'Genuine wear and irregular flan.'); assert.equal(form.condition_description, 'Corrosion and edge loss.');
  assert.match(notices.join(' '), /condition and required specifics/);
});
