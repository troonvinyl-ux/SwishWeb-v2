import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map();
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const stubs = {
  '@/lib/moduleScope': { activateModuleScope: async () => ({}) },
  '@/lib/niche': { getActiveNicheId: () => 'tunes_flip' },
  '@/lib/listingSubmission': { listingNicheId: () => 'tunes_flip' },
  '@/lib/itemPhotos': { asRecord: object, availableItemPhotos: item => item.media, itemPhotos: item => item.media.map(original => ({ original })) },
  '@/lib/listingReadiness': { permanentListingPhoto: value => value.startsWith('https://'), publicationBlock: row => row.external_listing_id || ['active', 'live', 'published', 'sold', 'ended'].includes(row.status) },
};
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics?.filter(value => value.category === ts.DiagnosticCategory.Error).length || 0, 0);
  const module = { exports: {} }; new Function('require', 'module', 'exports', compiled.outputText)(name => stubs[name] || (name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name)), module, module.exports); cache.set(path, module.exports); return module.exports;
}
const { saveSharedListingEditor } = load('src/lib/listingEditorSave.ts');
const { hydrateListingEditor, listingSpecifics } = load('src/lib/listingEditorData.ts');
function fixture() {
  const calls = [], form = { id: 'listing', item_id: 'item', tenant_id: 'tenant', title: 'Artist Album Vinyl Record', description: 'Media: VG\nSleeve: VG+', price: 18, status: 'draft', category_id: '176985', category: 'Vinyl Records', condition: 'Used', condition_id: '3000', condition_description: 'Media VG, sleeve VG+', quantity: 1, sku: 'R-12', dispatch_days: 3 };
  let listing = { ...form }, stock = { id: 'item', tenant_id: 'tenant', specialist_id: 'vinyl_records', updated_at: 'version-1', media: ['https://fixture.invalid/front.jpg'], condition_grade: 'legacy grade stays untouched', attributes: { ebay_item_specifics: [{ name: 'Artist', value: 'Artist' }, { name: 'Record Grading', value: 'VG' }] } };
  // Match the deployed shared RPC: it writes premium-editor notes to
  // condition_notes and deliberately preserves the legacy condition_grade.
  const client = { rpc: async (name, body) => { calls.push({ name, body }); listing = { ...listing, ...body.p_listing_patch }; stock = { ...stock, condition: body.p_item_patch.condition, condition_notes: body.p_item_patch.condition_notes, quantity: body.p_item_patch.quantity, sku: body.p_item_patch.sku, updated_at: 'version-2', attributes: { ...stock.attributes, ebay_category_id: body.p_item_patch.ebay_category_id, ebay_category_name: body.p_item_patch.ebay_category_name, ebay_item_specifics: body.p_specifics } }; return { data: 'listing', error: null }; }, from: table => { let patch = null; return { select() { return this; }, eq() { return this; }, update(value) { patch = value; return this; }, single: async () => ({ data: table === 'items' ? stock : listing, error: null }), maybeSingle: async () => { stock = { ...stock, ...patch, updated_at: 'version-3' }; return { data: stock, error: null }; } }; } };
  return { calls, input: { client, userId: 'user', tenantId: 'tenant', form, item: stock, photos: ['https://fixture.invalid/front.jpg'], uploads: [] } };
}
test('native RPC saves condition, category, stock and array specifics; legacy ignored metadata is retained', async () => {
  const { calls, input } = fixture(), result = await saveSharedListingEditor(input), body = calls[0].body;
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'swish_save_listing_editor');
  assert.equal(body.p_item_patch.condition, 'Used'); assert.equal(body.p_item_patch.quantity, 1); assert.equal(body.p_item_patch.sku, 'R-12');
  assert.deepEqual(body.p_item_patch.ebay_listing_media, input.photos); assert.equal(body.p_item_patch.ebay_listing_options.dispatchDays, 3);
  assert.deepEqual(body.p_specifics, [{ name: 'Artist', value: 'Artist' }, { name: 'Record Grading', value: 'Very Good (VG)' }]);
  const reopened = hydrateListingEditor(result.listing, result.item);
  assert.equal(reopened.category, 'Vinyl Records'); assert.equal(reopened.category_id, '176985'); assert.equal(reopened.condition, 'Used'); assert.equal(reopened.condition_id, '3000'); assert.equal(reopened.condition_description, input.form.condition_description);
  assert.deepEqual(result.item.attributes.ebay_listing_media, input.photos); assert.equal(body.p_listing_patch.images, undefined);
});
test('array and legacy map specifics survive a second save', async () => {
  assert.deepEqual(listingSpecifics([{ name: 'Artist', value: 'Artist' }]), { Artist: 'Artist' });
  assert.deepEqual(listingSpecifics({ Artist: 'Artist' }), { Artist: 'Artist' });
  const { input } = fixture(), first = await saveSharedListingEditor(input);
  const second = await saveSharedListingEditor({ ...input, form: hydrateListingEditor(first.listing, first.item), item: first.item });
  assert.deepEqual(listingSpecifics(second.item.attributes.ebay_item_specifics), { Artist: 'Artist', 'Record Grading': 'Very Good (VG)' });
});
test('vinyl shared-RPC notes, selected eight photos and reopen all retain their saved draft values', async () => {
  const { calls, input } = fixture();
  const photos = Array.from({ length: 8 }, (_, index) => `https://fixture.invalid/record-${index + 1}.jpg`);
  input.item.media = photos;
  input.photos = photos;
  const first = await saveSharedListingEditor(input);
  assert.equal(calls.length, 1);
  assert.equal(first.item.condition_grade, 'legacy grade stays untouched');
  assert.equal(first.item.condition_notes, input.form.condition_description);
  assert.deepEqual(first.item.attributes.ebay_listing_media, photos);
  const reopened = hydrateListingEditor(first.listing, first.item);
  assert.equal(reopened.condition_description, input.form.condition_description);
  const second = await saveSharedListingEditor({ ...input, form: { ...reopened, condition_description: 'Freshly saved condition note' }, item: first.item, photos });
  assert.equal(second.item.condition_notes, 'Freshly saved condition note');
  assert.equal(second.item.condition_grade, 'legacy grade stays untouched');
  assert.deepEqual(second.item.attributes.ebay_listing_media, photos);
});
test('confirmed corrections persist to canonical music evidence as well as eBay specifics', async () => {
  const { input } = fixture(), result = await saveSharedListingEditor({ ...input, confirmedMusic: { media_grade: 'VG+', play_tested: false } });
  assert.equal(result.item.attributes.media_grade, 'VG+'); assert.equal(result.item.attributes.play_tested, false);
  assert.equal(listingSpecifics(result.item.attributes.ebay_item_specifics)['Record Grading'], 'Very Good Plus (VG+)'); assert.equal(result.item.attributes._music_evidence.media_grade.source, 'user');
});
test('wrong workspace, invalid values, unsupported photos and existing submissions never save', async () => {
  for (const patch of [{ price: -1 }, { price: Infinity }, { title: '' }, { quantity: 1.5 }, { tenant_id: 'other' }, { external_listing_id: '123' }]) { const { calls, input } = fixture(); input.form = { ...input.form, ...patch }; await assert.rejects(() => saveSharedListingEditor(input)); assert.equal(calls.length, 0); }
  const { calls, input } = fixture(); input.photos = ['https://fixture.invalid/unrelated.jpg']; await assert.rejects(() => saveSharedListingEditor(input)); assert.equal(calls.length, 0);
});
test('short titles and incomplete category/condition can be saved without a web-only publication gate', async () => {
  const { input } = fixture(); input.form = { ...input.form, title: 'LP', price: 0, category: '', category_id: '', condition: '', condition_id: '' };
  const result = await saveSharedListingEditor(input); assert.equal(result.listing.title, 'LP'); assert.equal(result.listing.price, 0);
});
test('long specifics are reported, not silently truncated', async () => {
  const { calls, input } = fixture(); input.item.attributes.ebay_item_specifics[0].value = 'x'.repeat(66); await assert.rejects(() => saveSharedListingEditor(input), /no more than 65/); assert.equal(calls.length, 0);
});
test('metadata readback mismatch or denied compatibility update is never a successful save', async () => {
  const { input } = fixture(); input.client.from = table => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: table === 'items' ? { ...input.item, condition: 'Wrong' } : input.form, error: null }) });
  await assert.rejects(() => saveSharedListingEditor(input), /atomic save readback differs for: .*item\.condition/);
});
test('field-level readback diagnostics identify the failed persisted field', async () => {
  const { input } = fixture();
  const persistedListing = { ...input.form, shipping_cost: 0, floor_price: 0, ceiling_price: 0 };
  const persistedSpecifics = [{ name: 'Artist', value: 'Artist' }, { name: 'Record Grading', value: 'Very Good (VG)' }];
  input.client.from = table => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: table === 'items' ? { ...input.item, condition: input.form.condition, condition_notes: 'wrong note', quantity: 1, sku: input.form.sku, attributes: { ebay_item_specifics: persistedSpecifics } } : persistedListing, error: null }) });
  await assert.rejects(() => saveSharedListingEditor(input), /item\.condition_notes/);
});
test('save has no marketplace publication or parallel listing creation', () => {
  assert.doesNotMatch(readFileSync('src/lib/listingEditorSave.ts', 'utf8'), /route: 'publish'|swish_create_listing_draft|createClient|service_role/);
});
