import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript, rapidRecord } from './lib/load-rapid-typescript.mjs';
const originals = ['https://fixture.invalid/o.jpg', 'https://fixture.invalid/r.jpg'], prepared = ['https://fixture.invalid/studio/o.png', 'https://fixture.invalid/studio/r.png'];
function harness(fallback = false) {
  const notices = [], states = []; let selected = [...originals], saves = 0, refreshes = 0;
  const draft = { form: { item_id: 'coin' }, item: { id: 'coin', specialist_id: 'coins', attributes: {} }, adoptItem: item => { assert.equal(item.id, 'coin'); draft.item = item; }, refresh: async () => { refreshes++; }, setPhotos: updater => { selected = updater(selected); } };
  const hook = loadRapidTypescript('src/hooks/useListingCoinPhotoPreparation.ts', {
    react: { useState: initial => [initial, value => states.push(value)], useRef: value => ({ current: value }), useEffect: () => {} },
    sonner: { toast: { info: value => notices.push(value), warning: value => notices.push(value), error: value => notices.push(value), success: value => notices.push(value) } },
    '@/lib/itemPhotos': { asRecord: rapidRecord, itemPhotos: () => originals.map(original => ({ original, presentation: original })) },
    '@/lib/itemStudio': { prepareSavedCoinPhotos: async () => { saves++; return { prepared: !fallback, item: fallback ? undefined : { id: 'coin', tenant_id: 'tenant', specialist_id: 'coins', attributes: { prepared: true } }, photos: fallback ? originals : prepared, warnings: fallback ? ['Deploy the shared worker. Originals retained.'] : [] }; } },
  }).useListingCoinPhotoPreparation(draft, 'seller', 'tenant');
  return { hook, draft, selected: () => selected, saves: () => saves, refreshes: () => refreshes, notices, states, select: value => { selected = value; } };
}
test('retry uses shared pair engine and upgrades selected originals without adding evidence photographs', async () => {
  const h = harness(); await h.hook.prepare(); assert.deepEqual(h.selected(), prepared); assert.equal(h.saves(), 1); assert.equal(h.refreshes(), 1); assert.ok(h.notices.some(value => /originals remain available/.test(value)));
});
test('explicit omissions, extra photo order and an empty seller selection survive preparation', async () => {
  for (const selection of [[], [originals[1]], ['https://fixture.invalid/edge.jpg', originals[0]]]) { const h = harness(); h.select(selection); await h.hook.prepare(); assert.deepEqual(h.selected(), selection.map(url => originals.includes(url) ? prepared[originals.indexOf(url)] : url)); }
});
test('service fallback is not labelled a successful white-background result and never blocks the editor', async () => {
  const h = harness(true); await h.hook.prepare(); assert.deepEqual(h.selected(), originals); assert.equal(h.refreshes(), 0); assert.equal(h.states.at(-1), false); assert.ok(h.notices.some(value => /Deploy the shared worker/.test(value)));
});
test('ordinary photo retry does not publish or create another physical coin; failed List & Next stays on review', () => {
  const photos = readFileSync('src/components/features/ListingEditorPhotos.tsx', 'utf8'), hook = readFileSync('src/hooks/useListingCoinPhotoPreparation.ts', 'utf8');
  assert.match(photos, /ListingCoinPhotoPreparation/); assert.match(hook, /prepareSavedCoinPhotos/); assert.doesNotMatch(hook, /route: 'publish'|swish_create_listing_draft|\.insert\(/);
  const footer = readFileSync('src/components/features/RapidListingFooter.tsx', 'utf8'); assert.match(footer, /success => success \? finish\(\) : queue\.refresh\(\)/);
});
