import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const country = loadRapidTypescript('src/lib/coinCategoryCountry.ts');
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const facts = loadRapidTypescript('src/lib/coinListingFacts.ts');
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
const guard = loadRapidTypescript('src/lib/listingCoinCategory.ts');
// Synthetic fixture ID only. No production category ID is supplied by these helpers.
const indian = { id: '993101', name: 'Indian', isLeaf: true, categoryPath: 'Coins > Coins > British > Indian' };
const input = { nicheId: 'coins', specialistId: 'coins', title: 'Provisional British India Pice 1204', attributes: { country: 'British India', year: '1204', denomination: 'PICE', composition: 'Copper' } };
const ok = suggestions => ({ data: { success: true, suggestions }, error: null });
test('British India maps to India for taxonomy without overwriting recorded attribution', () => {
  for (const value of ['British India', 'British Indian', 'India', 'Indian', 'Coins > British > Indian']) assert.equal(country.coinCategoryCountry(value), 'India');
  assert.equal(country.coinCategoryCountry('British'), 'Britain');
  assert.equal(country.coinCategoryCountry('Russia or Italy'), null);
  assert.equal(context.coinCategoryContext(input.title, input.attributes).country, 'India');
  assert.equal(facts.coinListingFacts(input.attributes, input.title).country.value, 'British India');
  assert.equal(facts.coinListingFacts(input.attributes, input.title).year.value, '1204');
});
test('title lookup falls back to the known issuing geography through the existing SWISH service', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', input.title, async (endpoint, body) => {
    calls.push({ endpoint, body });
    assert.equal(body.route, 'get_category_suggestions');
    return ok(body.query === 'India coins' ? [indian] : []);
  }, input);
  assert.deepEqual(result, { id: indian.id, name: indian.name, categoryPath: indian.categoryPath });
  assert.deepEqual(calls.map(call => call.body.query), [input.title, input.title, 'India coins']);
  assert.equal(calls[2].endpoint, 'swish-ebay-category');
});
test('manual Indian category text is honoured instead of discarded for the listing title', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', 'Indian', async (_endpoint, body) => {
    calls.push(body.query); return ok([indian]);
  }, input);
  assert.equal(result.id, indian.id); assert.deepEqual(calls, ['Indian coins']);
});
test('name-only British India and Indian leaves are recognized but still need authoritative leaf proof', async () => {
  for (const name of ['Indian', 'British India']) {
    const row = { id: indian.id, name, isLeaf: true };
    assert.equal((await lookup.lookupListingCategory('tenant', input.title, async () => ok([row]), input)).id, row.id);
    await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => ok([{ ...row, isLeaf: undefined }]), input), /coin category/);
    await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => ok([{ ...row, isLeaf: false }]), input), /coin category/);
  }
});
test('unconverted dates do not reject India against Gregorian date ranges; explicit CE still enforces ranges', () => {
  const dated = { ...indian, name: 'Indian (1835–1947)', categoryPath: 'Coins > British > Indian (1835–1947)' };
  const scope = context.coinCategoryContext(input.title, input.attributes);
  assert.equal(scope.year, null); assert.equal(context.coinCategoryMismatch(dated, scope), null);
  for (const attributes of [{ country: 'India', date: '1204 AH' }, { country: 'India', year: '1940', calendar: 'Vikram Samvat' }]) assert.equal(context.coinCategoryContext('Indian pice', attributes).year, null);
  const ce = context.coinCategoryContext('British India Pice', { country: 'British India', year: '1204 CE' });
  assert.equal(ce.year, 1204); assert.match(context.coinCategoryMismatch(dated, ce), /date range/);
  const converted = context.coinCategoryContext(input.title, { ...input.attributes, gregorian_year: '1789' });
  assert.equal(converted.year, 1789);
  assert.equal(context.coinCategoryContext('Russian 5 kopeks', { country: 'Russia', year: '1759' }).year, 1759);
});
test('saved Indian selection passes the same editor guard without changing title, specifics or price', () => {
  const item = { id: 'coin', specialist_id: 'coins', attributes: { ...input.attributes, ebay_category_id: indian.id, ebay_category_name: indian.name, ebay_category_path: indian.categoryPath } };
  const form = { title: input.title, category_id: indian.id, category: indian.name, category_path: indian.categoryPath, item_specifics: { Country: 'British India', Year: '1204' }, price: 12 };
  const original = JSON.stringify({ item, form });
  assert.equal(guard.coinListingCategoryIssue(form, item), null); assert.equal(JSON.stringify({ item, form }), original);
});
test('a British ancestor is not mistaken for a British Indian leaf; wrong countries, lots and art remain rejected', async () => {
  const wrong = [
    { ...indian, id: '993102', name: 'British', categoryPath: 'Coins > British' },
    { ...indian, id: '993103', name: 'Russia', categoryPath: 'Coins > European > Russia' },
    { ...indian, id: '3410', name: 'Collections/Bulk Lots' },
    { ...indian, id: '360', name: 'Art Prints', categoryPath: 'Art > Art Prints' },
  ];
  assert.equal((await lookup.lookupListingCategory('tenant', input.title, async () => ok([...wrong, indian]), input)).id, indian.id);
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => ok(wrong), input), /coin category/);
});
test('shared service errors remain visible rather than being hidden by the final empty query', async () => {
  let calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => ++calls === 1 ? { data: null, error: { status: 503, message: 'eBay taxonomy temporarily unavailable' } } : ok([]), input), /eBay taxonomy temporarily unavailable/);
  assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', input.title, async () => { calls++; return { data: null, error: { status: 403, message: 'Membership required' } }; }, input), /Membership/);
  assert.equal(calls, 1);
});
test('no parallel resolver, guessed Indian ID, write or AI request is introduced', () => {
  for (const path of ['src/lib/coinCategoryCountry.ts', 'src/lib/coinCategoryDate.ts', 'src/lib/coinCategorySearches.ts']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\.rpc\(|\.from\(|fetch\(|chat\/completions|categoryId:\s*['"]\d+/);
  }
  assert.doesNotMatch(readFileSync('src/lib/categoryLookup.ts', 'utf8'), /browseCoinCategory|resolveCoinCategory|validate_category|get_category_children/);
});
