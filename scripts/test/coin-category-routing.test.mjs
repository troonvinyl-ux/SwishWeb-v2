import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
const coinContext = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts', { '@/lib/coinCategoryPolicy': policy, '@/lib/coinCategoryContext': coinContext });
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts', { '@/lib/coinCategoryPolicy': policy, '@/lib/coinCategoryContext': coinContext, '@/lib/itemPhotos': { asRecord: rapidRecord } });
const art = { id: '360', name: 'Art Prints', isLeaf: true, categoryPath: 'Art > Art Prints' };
const coin = { id: 'fixture-not-numeric', name: 'Italy', isLeaf: true, categoryPath: 'Coins > Coins > European > Italy' };
const liveCoin = { ...coin, id: '123456' }; // Synthetic taxonomy ID, never a production default.
const ok = suggestions => ({ data: { success: true, suggestions }, error: null });
const context = { nicheId: 'coins', specialistId: 'coins', title: 'Portrait on a worn Italian coin' };
test('coin lookup skips a top-ranked Art Prints leaf and retains actual Coins ancestry', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', 'Portrait', async (endpoint, body) => { calls.push({ endpoint, body }); return ok([art, liveCoin]); }, context);
  assert.deepEqual(result, { id: liveCoin.id, name: 'Italy', categoryPath: liveCoin.categoryPath });
  assert.equal(calls.length, 1); assert.equal(calls[0].body.nicheId, 'coins'); assert.match(calls[0].body.query, /^collectible coin /);
});
test('art-only results trigger bounded coin-only fallback, never a British-country default', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', 'Portrait', async (_endpoint, body) => { calls.push(body.query); return body.query === 'collectible coins Italy' ? ok([liveCoin]) : ok([art]); }, context);
  assert.equal(result.id, liveCoin.id); assert.deepEqual(calls, ['collectible coin Italy Portrait on a worn Italian coin', 'collectible coin Italy Portrait on a worn Italian coin', 'collectible coins Italy']);
});
test('unrelated, supply, wrong-object and non-leaf categories do not become coin selections', async () => {
  for (const row of [art, { ...liveCoin, name: 'Coin Holders' }, { ...liveCoin, name: 'Coins', categoryPath: 'Art > Coins' }, { ...liveCoin, name: 'Banknotes' }, { ...liveCoin, isLeaf: false }, { ...liveCoin, id: 'AI guess' }]) {
    let calls = 0;
    await assert.rejects(lookup.lookupListingCategory('tenant', 'Portrait', async () => { calls++; return ok([row]); }, context), /coin category/);
    assert.ok(calls >= 4 && calls <= 18, 'Country-led search and tree fallback remain bounded');
  }
});
test('coin relevance handles genuine country, ancient and hammered leaves without inventing attribution', () => {
  for (const name of ['Italy', 'Roman', 'Hammered', 'Other']) assert.equal(policy.isNumismaticCategory({ name, categoryPath: `Coins > ${name}` }), true);
  assert.equal(policy.isNumismaticCategory({ name: 'Italy' }), false);
  assert.equal(policy.isNumismaticCategory({ name: 'Ancient Coins' }), true);
  assert.equal(policy.isNumismaticCategory({ id: '360', name: 'Coins' }), false);
  assert.equal(policy.isNumismaticCategory({ name: 'Banknotes', categoryPath: 'Coins > Banknotes' }, 'banknote'), true);
  assert.equal(policy.usesNumismaticCategories('coins', 'jewellery_precious_metals'), false);
});
test('art and music workflows remain unaffected by the numismatic filter', async () => {
  assert.deepEqual(await lookup.lookupListingCategory('tenant', 'Print', async () => ok([art]), { nicheId: 'collectibles' }), { id: '360', name: 'Art Prints' });
  assert.equal((await lookup.lookupListingCategory('tenant', 'Album CD', async () => ok([{ id: '123', name: 'CDs', isLeaf: true }]), { nicheId: 'tunes_flip', attributes: { format: 'CD' } })).name, 'CDs');
});
test('saved Art Prints cannot pass the coin review guard, even with a misleading local label', () => {
  const item = { specialist_id: 'coins', attributes: {} };
  assert.match(guard.coinListingCategoryIssue({ category_id: '360', category: 'Art Prints' }, item), /Find eBay category/);
  assert.ok(guard.coinListingCategoryIssue({ category_id: '360', category: 'Coins' }, item));
  assert.equal(guard.coinListingCategoryIssue({ category_id: liveCoin.id, category: liveCoin.name, category_path: liveCoin.categoryPath }, item), null);
  assert.equal(guard.coinListingCategoryIssue({ category_id: '360', category: 'Art Prints' }, { specialist_id: 'collectibles' }), null);
});
test('AI-generated category, art specifics and condition IDs are removed before live enrichment', () => {
  assert.deepEqual(policy.discardGeneratedCoinCategory({ title: 'Worn coin', description: 'Visible wear.', recommended_price: 23.25, category_id: '360', category: 'Art Prints', condition_id: '3000', item_specifics: { Artist: 'Unknown' } }), { title: 'Worn coin', description: 'Visible wear.', recommended_price: 23.25, item_specifics: {} });
});
test('authorization denials and changed scopes still fail closed without taxonomy fallback', async () => {
  let calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', 'Portrait', async () => { calls++; return { data: null, error: { status: 403, message: 'Membership required' } }; }, context), /Membership required/);
  assert.equal(calls, 1);
  let current = true;
  await assert.rejects(lookup.lookupListingCategory('tenant', 'Portrait', async () => { current = false; return ok([liveCoin]); }, { ...context, isCurrent: () => current }), /workspace/);
});
