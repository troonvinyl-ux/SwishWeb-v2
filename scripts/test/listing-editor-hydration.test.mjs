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
  function render(runEffects = true) { index = 0; effects = []; const draft = useListingEditorDraft('listing', 'tenant'); if (runEffects) effects.forEach(effect => effect()); return draft; }
  return { rows, render };
}
const listing = { id: 'listing', item_id: 'item', tenant_id: 'tenant', title: 'Artist Album Vinyl', category_id: null, status: 'draft' };
const item = { id: 'item', tenant_id: 'tenant', updated_at: 'v1', condition: 'Used - Good', condition_grade: 'Surface marks', media: ['https://fixture.invalid/front.jpg'], attributes: { ebay_category_id: '176985', ebay_category_name: 'Vinyl Records', ebay_condition_id: '5000' } };
test('late matching item hydration restores saved category ID, label, condition and notes together', () => {
  const view = harness(); view.rows.listings = listing; view.render(); assert.equal(view.render().form.category, undefined);
  view.rows.items = item; view.render(); const draft = view.render(); assert.equal(draft.form.category_id, '176985'); assert.equal(draft.form.category, 'Vinyl Records'); assert.equal(draft.form.condition, 'Used - Good'); assert.equal(draft.form.condition_id, '5000');
});
test('background refetch cannot erase dirty selected category and condition', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render(); draft.change('category', 'CDs'); draft.change('category_id', 'fixture-cd'); draft.change('condition', 'Used - Very Good');
  view.rows.listings = { ...listing }; view.rows.items = { ...item }; view.render(); const next = view.render(); assert.equal(next.form.category, 'CDs'); assert.equal(next.form.category_id, 'fixture-cd'); assert.equal(next.form.condition, 'Used - Very Good'); assert.equal(next.dirty, true);
});
test('commit uses both confirmed readbacks rather than merging a listing-only response over stale stock', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = item; view.render(); const draft = view.render();
  const savedListing = { ...listing, category_id: '176985' }, savedItem = { ...item, updated_at: 'v2', condition: 'Used - Very Good', attributes: { ...item.attributes, ebay_listing_media: item.media } };
  draft.commit(savedListing, savedItem); view.rows.listings = savedListing; view.rows.items = savedItem; view.render(); const next = view.render(); assert.equal(next.form.category, 'Vinyl Records'); assert.equal(next.form.condition, 'Used - Very Good'); assert.equal(next.dirty, false); assert.match(next.revisionRef.current, /v2/);
});
test('a stock row from another tenant never hydrates the editor', () => {
  const view = harness(); view.rows.listings = listing; view.rows.items = { ...item, tenant_id: 'other' }; view.render(); assert.equal(view.render().form.id, undefined);
});
