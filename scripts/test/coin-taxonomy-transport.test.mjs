import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const taxonomy = loadRapidTypescript('src/lib/ebayTaxonomyResponse.ts');
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
const leaf = { id: '981001', name: 'Hungary', categoryPath: 'Coins > Coins > European > Hungary', isLeaf: true };
const context = { nicheId: 'coins', specialistId: 'coins', title: 'Hungary 1673 coin', attributes: { country: 'Hungary', year: '1673', period: 'hammered' } };
test('shared snake-case, wrapped data, and raw eBay category/ancestor transports normalize to a real coin leaf', async () => {
  for (const data of [
    { success: true, data: { categories: [{ category_id: leaf.id, category_name: leaf.name, category_path: leaf.categoryPath, is_leaf: true }] } },
    { categorySuggestions: [{ category: { categoryId: leaf.id, categoryName: leaf.name }, leafCategoryTreeNode: true, categoryTreeNodeAncestors: [{ categoryId: '1', categoryName: 'Coins', categoryTreeNodeLevel: 1 }, { categoryId: '2', categoryName: 'European', categoryTreeNodeLevel: 2 }] }] },
    { success: true, suggestions: [leaf] },
  ]) assert.equal((await lookup.lookupListingCategory('tenant', context.title, async () => ({ data, error: null }), context)).id, leaf.id);
});
test('native leaf labels do not require extra ancestry lookups, but absent leaf proof is never guessed', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', context.title, async (_endpoint, body) => {
    calls.push(body);
    return { error: null, data: { success: true, suggestions: [{ id: leaf.id, name: leaf.name, isLeaf: true }] } };
  }, context);
  assert.deepEqual(result, { id: leaf.id, name: leaf.name });
  assert.equal(calls.length, 1); assert.equal(calls[0].route, 'get_category_suggestions');
  await assert.rejects(lookup.lookupListingCategory('tenant', context.title, async () => ({ data: { suggestions: [{ id: leaf.id, name: leaf.name }] }, error: null }), context), /coin category/);
});
test('explicit invalidity, a different validated ID, another marketplace and absent leaf proof never become selections', () => {
  for (const data of [{ success: true, valid: false }, { success: true, categoryId: '981999', isLeaf: true }, { success: true, is_leaf: false }, { success: true, marketplace_id: 'EBAY_US', isLeaf: true }]) assert.equal(taxonomy.validatedTaxonomyRow(data, leaf).isLeaf, false);
  assert.equal(taxonomy.validatedTaxonomyRow({ success: true, valid: true }, { ...leaf, isLeaf: undefined }).isLeaf, undefined);
  assert.deepEqual(taxonomy.taxonomyRows({ success: false, data: { suggestions: [leaf] } }, 'suggestions'), []);
});
test('the reported Hungary hammered attribution accepts its country branch, not a guessed art, lot or foreign branch', async () => {
  const wrong = [{ ...leaf, id: '360', name: 'Art Prints', categoryPath: 'Art > Art Prints' }, { ...leaf, id: '3410', name: 'Collections/Bulk Lots' }, { ...leaf, id: '981002', name: 'Austria', categoryPath: 'Coins > European > Austria' }];
  const result = await lookup.lookupListingCategory('tenant', context.title, async () => ({ data: { success: true, suggestions: [...wrong, leaf] }, error: null }), context);
  assert.equal(result.id, leaf.id);
});
test('wrapped snake-case country leaves use normal suggestions without hammered wording or a private browser', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', context.title, async (_endpoint, body) => {
    calls.push(body); return { data: { success: true, data: { categories: [{ category_id: leaf.id, category_name: leaf.name, is_leaf: true }] } }, error: null };
  }, context);
  assert.equal(result.id, leaf.id);
  assert.deepEqual(calls.map(row => row.route), ['get_category_suggestions']);
});
