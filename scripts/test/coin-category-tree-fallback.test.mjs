import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
// Synthetic fixture IDs only; production IDs come from the existing SWISH taxonomy service.
const leaf = { id: '980005', name: 'Russia (Pre-1917)', isLeaf: true, categoryPath: 'Coins > European > Russia (Pre-1917)' };
const context = { nicheId: 'coins', specialistId: 'coins', title: 'Russia 5 kopeks 1759', attributes: { country: 'Russia', year: '1759' } };
test('category failure uses the shared title/country suggestion route, never the retired private tree walker', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', context.title, async (endpoint, body) => {
    calls.push({ endpoint, ...body });
    assert.equal(body.route, 'get_category_suggestions');
    return { data: { success: true, suggestions: body.query === 'Russia coins' ? [leaf] : [] }, error: null };
  }, context);
  assert.equal(result.id, leaf.id);
  assert.deepEqual(calls.map(row => row.query), [context.title, context.title, 'Russia coins']);
  assert.equal(calls[0].endpoint, 'swish-ebay-category');
  assert.doesNotMatch(readFileSync('src/lib/categoryLookup.ts', 'utf8'), /import.*(?:resolveCoinCategory|browseCoinCategory)/);
});
test('saved selections reuse live get_category_aspects, the same contract as native quickRequirements', async () => {
  const calls = [], selectedCategory = { id: leaf.id, name: leaf.name, categoryPath: leaf.categoryPath };
  const result = await lookup.lookupListingCategory('tenant', context.title, async (endpoint, body) => {
    calls.push({ endpoint, ...body });
    return { error: null, data: { success: true, isLeaf: true, marketplaceId: 'EBAY_GB', categoryId: leaf.id, aspects: [] } };
  }, { ...context, selectedCategory });
  assert.deepEqual(result, selectedCategory);
  assert.deepEqual(calls, [{ endpoint: 'swish-ebay-category', tenantId: 'tenant', nicheId: 'coins', route: 'get_category_aspects', categoryId: leaf.id, forceLive: true }]);
});
test('failed or foreign saved-category verification falls back to normal suggestions, never assumes validity', async () => {
  for (const metadata of [{ success: true, isLeaf: false }, { success: true, isLeaf: true, marketplaceId: 'EBAY_US', categoryId: leaf.id }, { success: true, isLeaf: true, marketplaceId: 'EBAY_GB', categoryId: '999999' }]) {
    const result = await lookup.lookupListingCategory('tenant', context.title, async (_endpoint, body) => ({ error: null, data: body.route === 'get_category_aspects' ? metadata : { success: true, suggestions: [leaf] } }), { ...context, selectedCategory: { id: leaf.id, name: leaf.name } });
    assert.equal(result.id, leaf.id);
  }
});
test('semantic ranking prefers an in-range period leaf but does not override geography or single-lot scope', async () => {
  const rows = [{ ...leaf, id: '980004', name: 'Russia', categoryPath: 'Coins > European > Russia' }, leaf];
  assert.equal((await lookup.lookupListingCategory('tenant', context.title, async () => ({ data: { success: true, suggestions: rows }, error: null }), context)).id, leaf.id);
});
test('authorization denial, scope changes and unavailable services remain read-only and bounded', async () => {
  let calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', context.title, async () => { calls++; return { data: null, error: { status: 403, message: 'Membership required' } }; }, context), /Membership/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', context.title, async () => { calls++; return { data: { success: true, suggestions: [] }, error: null }; }, context), /coin category/);
  assert.equal(calls, 4);
});
