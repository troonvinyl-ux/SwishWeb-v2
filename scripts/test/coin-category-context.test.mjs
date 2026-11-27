import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
const deps = { '@/lib/coinCategoryContext': context, '@/lib/coinCategoryPolicy': policy };
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts', deps);
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts', { ...deps, '@/lib/itemPhotos': { asRecord: rapidRecord } });
// These numeric IDs are fixture values, not default production taxonomy IDs.
const leaf = (id, name, path) => ({ id: String(id), name, categoryPath: path, isLeaf: true });
const bulk = leaf(3410, 'Collections/Bulk Lots', 'Coins > Coins > Collections/Bulk Lots');
const modern = leaf(910001, 'Italy', 'Coins > Coins > European > Italy');
const roman = leaf(910002, 'Roman Imperial', 'Coins > Coins > Ancient > Roman > Roman Imperial');
const greek = leaf(910003, 'Greek', 'Coins > Coins > Ancient > Greek');
const other = leaf(910004, 'Other Ancient Coins', 'Coins > Coins > Ancient > Other Ancient Coins');
const input = { nicheId: 'coins', specialistId: 'coins', title: 'Provisional: Roman Imperial Augustus As, Possible Ilici (Elche) Mint', attributes: { quantity: 1 } };
const ok = suggestions => ({ data: { success: true, suggestions }, error: null });
test('reported single Roman coin skips bulk, modern-country and Greek leaves, ranking Roman above generic ancient', async () => {
  const result = await lookup.lookupListingCategory('tenant', input.title, async () => ok([bulk, modern, greek, other, roman]), input);
  assert.deepEqual(result, { id: roman.id, name: roman.name, categoryPath: roman.categoryPath });
});
test('single-versus-lot does not depend on stock quantity, batch size or collectors envelope text', () => {
  for (const attributes of [{ quantity: 50 }, { collectorEnvelopeMode: true, notes: 'collection of 50 coins' }, { batchSize: 50 }, { lot_coin_count: 1 }]) {
    const facts = context.coinCategoryContext('Roman coin from an old collection', attributes);
    assert.equal(facts.lot, false); assert.ok(context.coinCategoryMismatch(bulk, facts));
  }
  assert.equal(policy.isNumismaticCategory(bulk), false);
  assert.equal(policy.isNumismaticCategory({ ...roman, id: '3410' }), false);
});
test('genuine explicitly declared lots remain supported without making every batch a lot', async () => {
  for (const attributes of [{ is_lot: true }, { listing_scope: 'lot' }, { coins_in_lot: 12 }]) assert.equal(context.coinCategoryContext('Coin group', attributes).lot, true);
  const lotInput = { nicheId: 'coins', title: 'Collection of 12 coins', attributes: {} };
  assert.equal((await lookup.lookupListingCategory('tenant', lotInput.title, async () => ok([modern, bulk]), lotInput)).id, bulk.id);
  assert.equal(policy.isNumismaticCategory(bulk, 'coin', 'lot'), true);
});
test('ancient fallback retains era and tradition and never chooses a bulk or modern result', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', input.title, async (_endpoint, body) => {
    calls.push(body.query); return body.query === 'ancient roman coins' ? ok([bulk, modern, roman]) : ok([bulk, modern]);
  }, input);
  assert.equal(result.id, roman.id); assert.equal(calls.length, 3);
  assert.deepEqual(calls, [input.title, input.title, 'ancient roman coins']);
});
test('only wrong categories leave an editable draft instead of a guessed ID', async () => {
  let calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => { calls++; return ok([bulk, modern, greek]); }, input), /coin category/);
  assert.equal(calls, 8, 'Suggestions plus bounded native tree recovery');
});
test('saved bulk selection, spoofed label and modern-category mismatch are flagged for the same physical coin', () => {
  const item = { specialist_id: 'coins', canonical_title: input.title, attributes: { quantity: 50 } };
  for (const row of [bulk, { ...roman, id: '3410' }, modern]) {
    const issue = guard.coinListingCategoryIssue({ title: input.title, category_id: row.id, category: row.name, category_path: row.categoryPath }, item);
    assert.match(issue, /Find eBay category/);
  }
  assert.equal(guard.coinListingCategoryIssue({ title: input.title, category_id: roman.id, category: roman.name, category_path: roman.categoryPath }, item), null);
});
test('hammered, modern and different Roman branches are not confused', () => {
  const hammered = leaf(910005, 'Hammered', 'Coins > British > Hammered');
  assert.equal(context.coinCategoryMismatch(hammered, context.coinCategoryContext('Hammered medieval penny')), null);
  assert.ok(context.coinCategoryMismatch(roman, context.coinCategoryContext('Modern coin', { year: 2000 })));
  assert.ok(context.coinCategoryMismatch(leaf(910006, 'Roman Republican', 'Coins > Ancient > Roman Republican'), context.coinCategoryContext(input.title)));
  assert.equal(context.coinCategoryMismatch(greek, context.coinCategoryContext('Hellenistic Greek bronze coin')), null);
});
test('leaf status, module denials and changed requests still fail closed', async () => {
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => ok([{ ...roman, isLeaf: false }]), input), /coin category/);
  let requests = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => { requests++; return { data: null, error: { status: 403, message: 'Access denied' } }; }, input), /Access denied/);
  assert.equal(requests, 1);
  let current = true;
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => { current = false; return ok([roman]); }, { ...input, isCurrent: () => current }), /workspace/);
});
