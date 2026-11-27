import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts');
const { verifyListingCategory } = loadRapidTypescript('src/lib/verifyListingCategory.ts');
// Synthetic IDs: never defaults or corrections for production categories.
const publications = { id: '994001', name: 'Publications', categoryPath: 'Coins > Coins > Publications', isLeaf: true };
const indian = { id: '994002', name: 'Indian', categoryPath: 'Coins > Coins > British > Indian', isLeaf: true };
const input = { nicheId: 'coins', specialistId: 'coins', title: 'British India Pice 1204', attributes: { country: 'British India', year: '1204', denomination: 'PICE' } };
const ok = suggestions => ({ data: { success: true, suggestions }, error: null });
const metadata = patch => ({ data: { success: true, isLeaf: true, marketplaceId: 'EBAY_GB', categoryId: indian.id, ...patch }, error: null });
test('Publications is never accepted as a physical coin, banknote, medal, token or lot merely because its ancestor is Coins', () => {
  for (const kind of ['coin', 'banknote', 'medal', 'token']) for (const name of ['Publications', 'Coin Publications', 'Numismatic Literature', 'Coin Catalogues', 'Price Guides', 'Reference Books', 'Magazines']) {
    const row = { ...publications, name };
    assert.equal(policy.isNumismaticCategory(row, kind), false);
    assert.equal(policy.isNumismaticCategory({ ...row, categoryPath: `${row.categoryPath} > Collections/Bulk Lots` }, kind, 'lot'), false);
  }
  assert.equal(policy.isNumismaticCategory({ ...publications, name: 'Indian' }), false, 'A renamed leaf cannot conceal a Publications ancestor');
  assert.equal(policy.isNumismaticCategory({ name: 'Publications' }), false);
  assert.match(context.coinCategoryMismatch(publications, context.coinCategoryContext(input.title, input.attributes)), /Publications/);
});
test('normal title lookup skips a top-ranked Publications result and selects the real Indian leaf', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', input.title, async (endpoint, body) => { calls.push({ endpoint, body }); return ok([publications, indian]); }, input);
  assert.equal(result.id, indian.id); assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, 'swish-ebay-category'); assert.equal(calls[0].body.query, input.title);
});
test('publication-only title responses retry the known country through the shared service, not a publications fallback', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', input.title, async (endpoint, body) => { calls.push({ endpoint, body }); return ok(body.query === 'India coins' ? [publications, indian] : [publications]); }, input);
  assert.equal(result.id, indian.id); assert.deepEqual(calls.map(call => call.body.query), [input.title, input.title, 'India coins']);
});
test('a saved Publications category is not reused and old drafts request a replacement without changing seller evidence', async () => {
  const calls = [], item = { id: 'coin', specialist_id: 'coins', attributes: { ...input.attributes, ebay_category_id: publications.id, ebay_category_name: publications.name, ebay_category_path: publications.categoryPath } };
  const form = { title: input.title, category_id: publications.id, category: publications.name, category_path: publications.categoryPath };
  const original = JSON.stringify({ form, item });
  assert.match(guard.coinListingCategoryIssue(form, item), /Publications/);
  const result = await lookup.lookupListingCategory('tenant', input.title, async (_endpoint, body) => { calls.push(body); return ok([publications, indian]); }, { ...input, selectedCategory: publications });
  assert.equal(result.id, indian.id); assert.deepEqual(calls.map(call => call.route), ['get_category_suggestions']);
  assert.equal(JSON.stringify({ form, item }), original);
});
test('live metadata overrides a misleading local country label for the same selected ID', async () => {
  await assert.rejects(verifyListingCategory('tenant', indian, async () => metadata({ categoryName: 'Publications', categoryPath: publications.categoryPath }), input), /Publications/);
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', input.title, async (_endpoint, body) => {
    calls.push(body.route); return body.route === 'get_category_aspects' ? metadata({ category: { categoryId: indian.id, categoryName: 'Publications', categoryPath: publications.categoryPath } }) : ok([{ ...indian, id: '994003' }]);
  }, { ...input, selectedCategory: indian });
  assert.equal(result.id, '994003'); assert.deepEqual(calls, ['get_category_aspects', 'get_category_suggestions']);
});
test('live checking uses the exact category ID and native live requirements contract, without mutations', async () => {
  const calls = [];
  assert.deepEqual(await verifyListingCategory('tenant', indian, async (endpoint, body) => { calls.push({ endpoint, body }); return metadata({}); }, input), { id: indian.id, name: indian.name, categoryPath: indian.categoryPath });
  assert.deepEqual(calls, [{ endpoint: 'swish-ebay-category', body: { route: 'get_category_aspects', tenantId: 'tenant', nicheId: 'coins', categoryId: indian.id, forceLive: true } }]);
  for (const patch of [{ categoryId: '994999' }, { marketplaceId: 'EBAY_US' }, { isLeaf: false }, { valid: false }, { success: false }]) await assert.rejects(verifyListingCategory('tenant', indian, async () => metadata(patch), input));
});
test('saved-category authorization and in-flight workspace changes never issue compatibility requests', async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => { calls++; return { data: null, error: { status, message: 'Forbidden' } }; }, { ...input, selectedCategory: indian }), /Forbidden/);
    assert.equal(calls, 1);
  }
  let current = true, calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => { calls++; current = false; return metadata({}); }, { ...input, selectedCategory: indian, isCurrent: () => current }), /workspace/);
  assert.equal(calls, 1);
});
test('true publications workflows outside the coin specialist remain available', async () => {
  assert.equal((await lookup.lookupListingCategory('tenant', 'Coin reference book', async () => ok([publications]), { nicheId: 'antiques', specialistId: 'antique_books' })).id, publications.id);
  assert.equal(guard.coinListingCategoryIssue({ category_id: publications.id, category: publications.name }, { specialist_id: 'antique_books' }), null);
});
