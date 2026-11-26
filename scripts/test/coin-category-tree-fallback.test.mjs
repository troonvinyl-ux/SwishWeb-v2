import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const lookup = loadRapidTypescript('src/lib/categoryLookup.ts');
// Synthetic fixture IDs only. No category ID is a production fallback.
const node = (id, name, isLeaf = false) => ({ id: String(id), name, isLeaf });
const root = node(980001, 'Coins'), coins = node(980002, 'Coins'), europe = node(980003, 'European');
const russia = node(980004, 'Russia'), dated = node(980005, 'Russia (Pre-1917)', true);
const tree = { 0: [node(980000, 'Art'), root], [root.id]: [coins], [coins.id]: [node(980006, 'Ancient'), node(980007, 'Collections/Bulk Lots', true), europe], [europe.id]: [node(980008, 'Italy', true), russia], [russia.id]: [node(980009, 'Soviet Union (1917–1991)', true), dated] };
const context = { nicheId: 'coins', specialistId: 'coins', title: 'Collector-labelled Russia 5 kopeks 1759 coin', attributes: { collector_envelope: { transcription: 'Russia / 5 kopeks / 1759' } } };
test('empty keyword suggestions browse the real country branch and select the dated leaf without inventing an ID', async () => {
  const calls = [];
  const result = await lookup.lookupListingCategory('tenant', context.title, async (endpoint, body) => {
    calls.push({ endpoint, ...body });
    if (body.route === 'get_category_suggestions') return { data: { success: true, suggestions: [] }, error: null };
    assert.equal(body.route, 'get_category_children'); assert.equal(body.tenantId, 'tenant'); assert.equal(body.nicheId, 'coins');
    return { data: { success: true, children: tree[body.parentId] || [] }, error: null };
  }, context);
  assert.equal(result.id, dated.id); assert.match(result.categoryPath, /Coins > Coins > European > Russia > Russia \(Pre-1917\)/);
  assert.ok(calls.filter(call => call.route === 'get_category_children').length <= 10);
  assert.ok(calls.some(call => call.query === 'Russia coins'));
  assert.ok(calls.every(call => !/publish|create|save|update/.test(call.route)));
});
test('a country-only suggestion query succeeds even if over-specific dated searches return no leaf', async () => {
  const leaf = { ...dated, categoryPath: 'Coins > Coins > European > Russia (Pre-1917)' };
  const result = await lookup.lookupListingCategory('tenant', context.title, async (_endpoint, body) => ({ data: { success: true, suggestions: body.query === 'Russia coins' ? [leaf] : [] }, error: null }), context);
  assert.equal(result.id, dated.id);
});
test('when both a broad Russia leaf and a valid pre-1917 leaf are returned, the dated leaf ranks higher', async () => {
  const rows = [{ ...russia, isLeaf: true, categoryPath: 'Coins > European > Russia' }, { ...dated, categoryPath: 'Coins > European > Russia (Pre-1917)' }];
  const result = await lookup.lookupListingCategory('tenant', context.title, async () => ({ data: { success: true, suggestions: rows }, error: null }), context);
  assert.equal(result.id, dated.id);
});
test('browse authorization denial and workspace changes are never bypassed', async () => {
  let current = true;
  for (const denial of [true, false]) {
    current = true;
    await assert.rejects(lookup.lookupListingCategory('tenant', context.title, async (_endpoint, body) => {
      if (body.route === 'get_category_suggestions') return { data: { success: true, suggestions: [] }, error: null };
      if (denial) return { data: null, error: { status: 403, message: 'Membership required' } };
      current = false; return { data: { success: true, children: [root] }, error: null };
    }, { ...context, isCurrent: () => current }), denial ? /Membership/ : /workspace/);
  }
});
test('a disconnected tree still leaves the draft editable without fabricating a selected category', async () => {
  let calls = 0;
  await assert.rejects(lookup.lookupListingCategory('tenant', context.title, async () => { calls++; return { data: { success: true, suggestions: [] }, error: null }; }, context), /coin category/);
  assert.ok(calls <= 18);
});
