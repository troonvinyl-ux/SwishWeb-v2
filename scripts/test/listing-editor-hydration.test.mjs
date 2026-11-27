import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function harness() {
  let index = 0, slots = [], effects = [], rows = { listings: null, items: null };
  const react = {
    useState(initial) { const position = index++; if (!(position in slots)) slots[position] = initial; return [slots[position], value => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }]; },
    useRef(initial) { const position = index++; if (!(position in slots)) slots[position] = { current: initial }; return slots[position]; },
    useEffect(effect, deps) { const position = index++, prior = slots[position]; if (!prior || deps.some((value, i) => value !== prior[i])) effects.push(effect); slots[position] = deps; },
  };
  const stubs = { react, '@/hooks/useSupabaseQuery': { useTableRow: table => ({ data: rows[table], isLoading: false, error: null, refetch: async () => ({ data: rows[table] }) }) }, '@/lib/itemPhotos': { asRecord: record, availableItemPhotos: item => item.media, itemPhotos: item => item.media.map(original => ({ original, presentation: original })) } };
  const cache = new Map();
  function load(path) { if (cache.has(path)) return cache.get(path); const module = { exports: {} }, code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText; new Function('require', 'module', 'exports', code)(name => stubs[name] || load(`src/${name.slice(2)}.ts`), module, module.exports); cache.set(path, module.exports); return module.exports; }
  const { useListingEditorDraft } = load('src/hooks/useListingEditorDraft.ts');
  function render() { index = 0; effects = []; const draft = useListingEditorDraft('listing', 'tenant'); effects.forEach(effect => effect()); return draft; }
  return { rows, render };
}
const listing = { id: 'listing', item_id: 'item', tenant_id: 'tenant', title: 'Artist Album Vinyl', category_id: null, status: 'draft' };
const eightPhotos = Array.from({ length: 8 }, (_, index) => `https://fixture.invalid/record-${index + 1}.jpg`);
const item = { id: 'item', tenant_id: 'tenant', specialist_id: 'vinyl_records', updated_at: 'v1', condition: 'Used', condition_grade: 'legacy grade', condition_notes: 'Surface marks', media: eightPhotos, attributes: { ebay_category_id: '176985', ebay_category_name: 'Vinyl Records', ebay_condition_id: '3000', ebay_listing_media: eightPhotos } };
test('late matching item restores the saved category, condition ID, label and notes', () => {
  const view = harness(); view.rows.listings = listing; view.render(); assert.equal(view.render().form.category, undefined);
  view.rows.items = item; view.render(); const draft = view.render(); assert.equal(draft.form.category_id, '176985'); assert.equal(draft.form.category, 'Vinyl Records'); assert.equal(draft.form.condition, 'Used'); assert.equal(draft.form.condition_id, '3000'); assert.equal(draft.form.condition_description, 'Surface marks'); assert.deepEqual(draft.photos, eightPhotos);
});
test('background refetch cannot erase dirty category and condition selections', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render(); draft.change('category', 'CDs'); draft.change('category_id', 'fixture-cd'); draft.change('condition', 'Very Good'); draft.change('condition_id', '4000');
  view.rows.listings = { ...listing }; view.rows.items = { ...item }; view.render(); const next = view.render(); assert.equal(next.form.category, 'CDs'); assert.equal(next.form.category_id, 'fixture-cd'); assert.equal(next.form.condition_id, '4000'); assert.equal(next.dirty, true);
});
test('background refetch cannot erase dirty notes or the eight selected vinyl photos', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render();
  draft.change('condition_description', 'Unsaved play-test detail'); draft.setPhotos(eightPhotos.slice(0, 7));
  view.rows.listings = { ...listing }; view.rows.items = { ...item }; view.render(); const next = view.render();
  assert.equal(next.form.condition_description, 'Unsaved play-test detail'); assert.deepEqual(next.photos, eightPhotos.slice(0, 7)); assert.equal(next.dirty, true);
});
test('commit uses both confirmed readbacks rather than stale stock', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render();
  const savedListing = { ...listing, updated_at: 'v2', category_id: '176985' }, savedItem = { ...item, updated_at: 'v2', condition: 'Very Good', attributes: { ...item.attributes, ebay_condition_id: '4000' } };
  draft.commit(savedListing, savedItem); view.rows.listings = savedListing; view.rows.items = savedItem; view.render(); const next = view.render(); assert.equal(next.form.category, 'Vinyl Records'); assert.equal(next.form.condition, 'Very Good'); assert.equal(next.dirty, false); assert.match(next.revisionRef.current, /v2/);
});
test('an older response after save cannot erase category, condition or canonical item', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render();
  draft.commit({ ...listing, updated_at: 'v2', category_id: '176985' }, { ...item, updated_at: 'v2', condition: 'Very Good', attributes: { ...item.attributes, ebay_condition_id: '4000' } });
  view.rows.listings = { ...listing }; view.rows.items = { ...item }; view.render(); const next = view.render(); assert.equal(next.form.category_id, '176985'); assert.equal(next.form.condition_id, '4000'); assert.equal(next.form.condition, 'Very Good'); assert.equal(next.item.updated_at, 'v2');
});
test('stock from another tenant never hydrates the editor', () => { const view = harness(); view.rows.listings = listing; view.rows.items = { ...item, tenant_id: 'other' }; view.render(); assert.equal(view.render().form.id, undefined); });
test('clean refresh adopts saved photo choices rather than retaining the old originals forever', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render();
  view.rows.items = { ...item, attributes: { ...item.attributes, ebay_listing_media: [eightPhotos[7]] } }; view.render(); assert.deepEqual(view.render().photos, [eightPhotos[7]]);
  view.rows.items = { ...item, attributes: { ...item.attributes, ebay_listing_media: [] } }; view.render(); assert.deepEqual(view.render().photos, []);
});
test('verified studio item readback updates allowed photo metadata without discarding dirty copy', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render();
  draft.change('title', 'My unsaved seller title'); draft.adoptItem({ ...item, updated_at: 'studio-version', attributes: { ...item.attributes, _smart_studio_images: { front: { originalUri: eightPhotos[0] } } } });
  const next = view.render(); assert.equal(next.form.title, 'My unsaved seller title'); assert.equal(next.dirty, true); assert.equal(next.item.updated_at, 'studio-version');
  assert.throws(() => next.adoptItem({ ...item, tenant_id: 'another' }), /different stock item/);
});
