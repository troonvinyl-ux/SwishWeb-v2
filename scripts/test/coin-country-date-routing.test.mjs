import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const policy = loadRapidTypescript('src/lib/coinCategoryPolicy.ts');
const deps = { '@/lib/coinCategoryContext': context, '@/lib/coinCategoryPolicy': policy };
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts', deps);
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts', { ...deps, '@/lib/itemPhotos': { asRecord: rapidRecord } });
const leaf = (id, name, categoryPath) => ({ id: String(id), name, categoryPath, isLeaf: true });
// All IDs here are synthetic fixtures, never production defaults.
const russia = leaf(990001, 'Russia', 'Coins > Coins > European > Russia');
const italy = leaf(990002, 'Italy', 'Coins > Coins > European > Italy');
const soviet = leaf(990003, 'Soviet Union (1917–1991)', 'Coins > European > Russia > Soviet Union (1917–1991)');
const modernRussia = leaf(990004, 'Russian Federation', 'Coins > European > Russia > Russian Federation');
const bulk = leaf(3410, 'Collections/Bulk Lots', 'Coins > Coins > Collections/Bulk Lots');
const ok = suggestions => ({ data: { success: true, suggestions }, error: null });
const input = { nicheId: 'coins', specialistId: 'coins', title: 'Russian copper 5 kopeks 1759', attributes: { coinFields: { country: 'Russia', year: 1759 } } };
test('single Russian 1759 coin skips unrelated countries, lots, Soviet and federation branches', async () => {
  const result = await lookup.lookupListingCategory('tenant', input.title, async () => ok([bulk, italy, soviet, modernRussia, russia]), input);
  assert.equal(result.id, russia.id);
});
test('shared title lookup retries issuing country without requiring the date in taxonomy wording', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', input.title, async (_endpoint, body) => {
    calls.push(body.query); return body.query === 'Russia coins' ? ok([italy, russia]) : ok([italy, soviet, bulk]);
  }, input);
  assert.equal(result.id, russia.id); assert.equal(calls.length, 3);
  assert.deepEqual(calls, [input.title, input.title, 'Russia coins']);
});
test('saved wrong country is flagged even when stock facts use native column aliases', () => {
  const item = { specialist_id: 'coins', country_of_origin: 'Russia', year_made: 1759, attributes: {} };
  assert.match(guard.coinListingCategoryIssue({ title: 'Copper 5 kopeks', category_id: italy.id, category: italy.name, category_path: italy.categoryPath }, item), /Russia/);
});
test('nested, confirmed and camel-case country/date facts are available to the same policy', () => {
  for (const attrs of [{ coinFields: { countryOfOrigin: 'Russia', year: 1759 } }, { country_of_origin: 'Russia', year_made: 1759 }, { country: 'Italy', attributesConfirmed: { country: 'Russia', year: 1759 } }]) {
    const facts = context.coinCategoryContext('Copper coin', attrs);
    assert.equal(facts.country, 'Russia'); assert.equal(facts.year, 1759); assert.ok(context.coinCategoryMismatch(italy, facts));
  }
});
test('modern Greek coins are not automatically put into Ancient Greek', () => {
  const facts = context.coinCategoryContext('Greek 10 drachma 1967');
  assert.equal(facts.period, 'modern'); assert.equal(facts.tradition, null);
  assert.equal(context.coinCategoryMismatch(leaf(990005, 'Greece', 'Coins > European > Greece'), facts), null);
  assert.ok(context.coinCategoryMismatch(leaf(990006, 'Greek', 'Coins > Ancient > Greek'), facts));
});
test('ancient mint geography is not a modern issuing-country assertion; BCE and ranges do not invent years', () => {
  const facts = context.coinCategoryContext('Roman Imperial coin, Ilici mint', { country: 'Spain' });
  assert.equal(context.coinCategoryMismatch(leaf(990007, 'Roman Imperial', 'Coins > Ancient > Roman Imperial'), facts), null);
  assert.equal(context.coinCategoryContext('Ancient coin 2000 BCE').year, null);
  assert.equal(context.coinCategoryContext('Copper coin', { date_range: '1759–1762' }).year, null);
});
test('equal semantic matches preserve eBay ordering as in normal SWISH quickRequirements', async () => {
  const result = await lookup.lookupListingCategory('tenant', input.title, async () => ok([russia, { ...russia, id: '990008' }]), input);
  assert.equal(result.id, russia.id);
});
test('only wrong categories fail without guessing or changing the draft', async () => {
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => ok([bulk, italy, soviet]), input), /coin category/);
});
