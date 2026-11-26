import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts');
const context = { nicheId: 'coins', specialistId: 'coins', title: 'Hungary 1673 coin', attributes: { country: 'Hungary', year: '1673', period: 'hammered' } };
const european = { id: '993001', name: 'Other European Coins', categoryPath: 'Coins > Coins > European > Other European Coins', isLeaf: true };
const hungary = { id: '993002', name: 'Hungary', categoryPath: 'Coins > Coins > European > Hungary', isLeaf: true };
const response = rows => async () => ({ data: { success: true, suggestions: rows }, error: null });
// IDs are synthetic test values; no production category is hard-coded.
test('a valid wider coin subcategory is not rejected merely for lacking country or manufacturing-style wording', async () => {
  const result = await lookup.lookupListingCategory('tenant', context.title, response([european]), context);
  assert.equal(result.id, european.id);
  assert.equal(guard.coinListingCategoryIssue({ title: context.title, category_id: result.id, category: result.name, category_path: result.categoryPath }, { specialist_id: 'coins', attributes: context.attributes }), null);
});
test('a specific matching country still outranks a broader valid leaf returned by the same service', async () => {
  assert.equal((await lookup.lookupListingCategory('tenant', context.title, response([european, hungary]), context)).id, hungary.id);
});
test('explicit wrong-country, ancient-period, artwork and bulk-lot contradictions remain rejected', async () => {
  for (const row of [
    { ...hungary, name: 'Austria', categoryPath: 'Coins > European > Austria' },
    { ...hungary, name: 'Roman Imperial', categoryPath: 'Coins > Ancient > Roman Imperial' },
    { ...hungary, id: '360', name: 'Art Prints', categoryPath: 'Art > Art Prints' },
    { ...hungary, id: '3410', name: 'Collections/Bulk Lots', categoryPath: 'Coins > Collections/Bulk Lots' },
  ]) await assert.rejects(lookup.lookupListingCategory('tenant', context.title, response([row]), context), /coin category/);
});
