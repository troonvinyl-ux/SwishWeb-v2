import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const stubs = {
  '@/lib/moduleScope': { activateModuleScope: async () => ({}) },
  '@/lib/niche': { getActiveNicheId: () => 'tunes_flip' },
  '@/lib/itemPhotos': { asRecord: object, availableItemPhotos: item => item.media, itemPhotos: item => item.media.map(original => ({ original })) },
  '@/lib/listingReadiness': { permanentListingPhoto: value => value.startsWith('https://'), publicationBlock: row => row.external_listing_id || row.publish_claim_id || row.status === 'active' },
};
const compiled = ts.transpileModule(readFileSync('src/lib/listingEditorSave.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.filter(value => value.category === ts.DiagnosticCategory.Error).length || 0, 0);
const module = { exports: {} }; new Function('require', 'module', 'exports', compiled.outputText)(name => stubs[name], module, module.exports);
const { saveSharedListingEditor } = module.exports;
function fixture() {
  const calls = [], form = { id: 'listing', item_id: 'item', tenant_id: 'tenant', title: 'Artist Album Vinyl Record', description: 'Media: VG\nSleeve: VG+', price: 18, status: 'draft', category_id: '176985', category: 'Vinyl Records', condition: 'Used - Good', condition_description: 'Media VG, sleeve VG+', quantity: 1, sku: 'R-12', dispatch_days: 3 };
  const client = { rpc: async (name, body) => { calls.push({ name, body }); return { data: true, error: null }; }, from: table => { const query = { select() { return this; }, eq() { return this; }, single: async () => ({ data: form, error: null }) }; return query; } };
  return { calls, input: { client, userId: 'user', tenantId: 'tenant', form, item: { id: 'item', tenant_id: 'tenant', specialist_id: 'vinyl_records', media: ['https://fixture.invalid/front.jpg'], attributes: { ebay_item_specifics: { Artist: 'Artist', 'Record Grading': 'VG' } } }, photos: ['https://fixture.invalid/front.jpg'], uploads: [] } };
}
test('native RPC saves shared condition, stock, specifics and photo selection; no parallel schema', async () => {
  const { calls, input } = fixture(); await saveSharedListingEditor(input);
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'swish_save_listing_editor');
  const body = calls[0].body;
  assert.equal(body.p_item_patch.condition, 'Used - Good'); assert.equal(body.p_item_patch.quantity, 1); assert.equal(body.p_item_patch.sku, 'R-12');
  assert.deepEqual(body.p_item_patch.ebay_listing_media, input.photos); assert.equal(body.p_item_patch.ebay_listing_options.dispatchDays, 3);
  assert.deepEqual(body.p_specifics, [{ name: 'Artist', value: 'Artist' }, { name: 'Record Grading', value: 'VG' }]);
  assert.equal(body.p_listing_patch.category_id, '176985'); assert.equal(body.p_listing_patch.images, undefined); assert.equal(body.p_listing_patch.condition, undefined);
});
test('wrong workspace, invalid values, unsupported photos and existing submissions never save', async () => {
  for (const patch of [{ price: 0 }, { price: Infinity }, { title: 'Short' }, { quantity: 1.5 }, { tenant_id: 'other' }, { external_listing_id: '123' }, { publish_claim_id: 'claim' }]) {
    const { calls, input } = fixture(); input.form = { ...input.form, ...patch }; await assert.rejects(() => saveSharedListingEditor(input)); assert.equal(calls.length, 0);
  }
  const { calls, input } = fixture(); input.photos = ['https://fixture.invalid/unrelated.jpg']; await assert.rejects(() => saveSharedListingEditor(input)); assert.equal(calls.length, 0);
});
test('long specifics are surfaced, not silently truncated or sent', async () => {
  const { calls, input } = fixture(); input.item.attributes.ebay_item_specifics.Artist = 'x'.repeat(66); await assert.rejects(() => saveSharedListingEditor(input), /no more than 65/); assert.equal(calls.length, 0);
});
test('save has no marketplace publication or new listing creation side effects', () => {
  assert.doesNotMatch(readFileSync('src/lib/listingEditorSave.ts', 'utf8'), /route: 'publish'|swish_create_listing_draft|createClient|service_role/);
});
