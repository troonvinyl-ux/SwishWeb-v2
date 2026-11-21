import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map();
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const stubs = { '@/lib/captureRequest': { captureRecord: record }, '@/lib/moduleScope': { activateModuleScope: async () => {} }, '@/lib/listingSubmission': { listingNicheId: () => 'tunes_flip' } };
function load(path) { if (cache.has(path)) return cache.get(path); const module = { exports: {} }, output = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true }); assert.equal(output.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error).length || 0, 0, path); new Function('require', 'module', 'exports', output.outputText)(name => stubs[name] || (name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name)), module, module.exports); cache.set(path, module.exports); return module.exports; }
const contract = load('src/lib/ebayMusicContract.ts'), { musicSpecifics } = load('src/lib/musicListing.ts'), { MUSIC_DEFAULTS } = load('src/constants/music.ts');
const { hydrateListingEditor, listingSpecifics } = load('src/lib/listingEditorData.ts'), { musicSnapshotFromItem } = load('src/lib/musicSavedItem.ts'), { saveSharedListingEditor } = load('src/lib/listingEditorSave.ts');
test('music grading uses exact eBay text, with Goldmine Poor explicitly represented as Worn', () => {
  const expected = { M: 'Mint (M)', NM: 'Near Mint (NM or M-)', EX: 'Excellent (EX)', 'VG+': 'Very Good Plus (VG+)', VG: 'Very Good (VG)', 'G+': 'Good Plus (G+)', G: 'Good (G)', F: 'Fair (F)', W: 'Worn (W)', P: 'Worn (W)' };
  for (const [code, label] of Object.entries(expected)) { assert.equal(contract.ebayMusicGrade(code), label); if (code !== 'P') assert.equal(contract.musicGradeCode(label), code); }
  assert.equal(contract.ebayMusicGrade('NM', ['Near Mint (NM or M-)']), 'Near Mint (NM or M-)');
});
test('native music aspect names differ for vinyl, CDs and cassettes', () => {
  for (const [format, media, packaging] of [['Vinyl', 'Record Grading', 'Sleeve Grading'], ['CD', 'CD Grading', 'Case Condition'], ['Cassette', 'Cassette Condition', 'Case Condition']]) {
    const specifics = musicSpecifics({ ...MUSIC_DEFAULTS, format, media_grade: 'VG+', sleeve_grade: 'NM' }); assert.equal(specifics[media], 'Very Good Plus (VG+)'); assert.equal(specifics[packaging], 'Near Mint (NM or M-)');
    if (format !== 'Vinyl') assert.equal(specifics['Record Grading'], undefined);
  }
});
test('music item condition IDs are stable, with no inferred Brand New from a Mint grade', () => {
  assert.equal(contract.ebayConditionId('Used – Like New'), '2750'); assert.equal(contract.ebayConditionId('Very Good'), '4000'); assert.equal(contract.ebayConditionId('Used - Good'), '5000'); assert.equal(contract.ebayConditionId('Acceptable'), '6000'); assert.equal(contract.ebayConditionId('Media M; sleeve NM'), '');
  const form = hydrateListingEditor({ id: 'listing' }, { specialist_id: 'vinyl_records', condition: 'Media M; sleeve NM', attributes: { media_grade: 'M', sleeve_grade: 'NM' } }); assert.equal(form.condition_id, ''); assert.equal(form.condition, '');
});
test('localized category values are normalized without dropping unrelated seller specifics', () => {
  const aspects = contract.normalizeEbayAspects([{ localizedAspectName: 'Record Grading', aspectConstraint: { aspectMode: 'SELECTION_ONLY' }, aspectValues: [{ localizedValue: 'Very Good Plus (VG+)' }] }]);
  assert.equal(aspects[0].selectionOnly, true); assert.deepEqual(contract.normalizeMusicSpecifics({ 'Record Grading': 'VG+', 'Seller Feature': 'Poster included' }, aspects), { 'Record Grading': 'Very Good Plus (VG+)', 'Seller Feature': 'Poster included' });
});
test('array specifics hydrate CD format and retain Poor as seller evidence across reopening', () => {
  const cd = musicSnapshotFromItem({ attributes: { ebay_item_specifics: [{ name: 'Format', value: 'CD' }, { name: 'CD Grading', value: 'Near Mint (NM or M-)' }, { name: 'Case Condition', value: 'Good (G)' }] } }); assert.equal(cd.values.format, 'CD'); assert.equal(cd.values.media_grade, 'NM'); assert.equal(cd.values.sleeve_grade, 'G');
  const poor = musicSnapshotFromItem({ attributes: { media_grade: 'P', ebay_item_specifics: [{ name: 'Record Grading', value: 'Worn (W)' }] } }); assert.equal(poor.values.media_grade, 'P');
});
test('one editor save persists category, condition, media and sleeve grades with legacy RPC metadata compatibility', async () => {
  const photo = 'https://fixture.invalid/record.jpg', calls = [];
  let item = { id: 'item', tenant_id: 'tenant', specialist_id: 'vinyl_records', updated_at: '2026-11-21T00:00:00Z', media: [photo], condition: 'Used - Good', attributes: { artist: 'Artist', format: 'Vinyl', ebay_item_specifics: [{ name: 'Artist', value: 'Artist' }, { name: 'Record Grading', value: 'VG' }, { name: 'Seller Feature', value: 'Poster included' }] } };
  let listing = { id: 'listing', tenant_id: 'tenant', item_id: 'item', marketplace_id: 'ebay', status: 'draft', title: 'Artist Album Vinyl', description: 'Condition\nMedia: VG\nSleeve: G\n\nTracklisting\nA1 Song', price: 18, category_id: null };
  const form = { ...hydrateListingEditor(listing, item), category_id: '176985', category: 'Vinyl Records', condition: 'Very Good', condition_id: '4000', condition_description: 'Light surface marks; original sleeve included.', music_values: { ...MUSIC_DEFAULTS, artist: 'Artist', format: 'Vinyl', media_grade: 'VG+', sleeve_grade: 'NM' } };
  const client = { rpc: async (name, body) => { calls.push({ name, body }); listing = { ...listing, ...body.p_listing_patch }; item = { ...item, condition: body.p_item_patch.condition, condition_grade: body.p_item_patch.condition_grade, updated_at: '2026-11-21T00:00:01Z', attributes: { ...item.attributes, ebay_item_specifics: body.p_specifics, ebay_category_name: body.p_item_patch.ebay_category_name } }; return { data: 'listing', error: null }; }, from: table => { let patch = null; return { select() { return this; }, eq() { return this; }, update(value) { patch = value; return this; }, single: async () => ({ data: table === 'items' ? item : listing, error: null }), maybeSingle: async () => { item = { ...item, ...patch, updated_at: '2026-11-21T00:00:02Z' }; return { data: item, error: null }; } }; } };
  const saved = await saveSharedListingEditor({ client, userId: 'user', tenantId: 'tenant', form, item, photos: [photo], uploads: [] });
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'swish_save_listing_editor'); const reopened = hydrateListingEditor(saved.listing, saved.item), specifics = listingSpecifics(saved.item.attributes.ebay_item_specifics);
  assert.equal(reopened.category_id, '176985'); assert.equal(reopened.category, 'Vinyl Records'); assert.equal(reopened.condition_id, '4000'); assert.equal(reopened.condition, 'Very Good'); assert.equal(reopened.condition_description, form.condition_description);
  assert.equal(specifics['Record Grading'], 'Very Good Plus (VG+)'); assert.equal(specifics['Sleeve Grading'], 'Near Mint (NM or M-)'); assert.equal(specifics['Seller Feature'], 'Poster included'); assert.equal(saved.item.attributes.media_grade, 'VG+'); assert.equal(saved.item.attributes.sleeve_grade, 'NM'); assert.match(saved.listing.description, /Media: VG\+\nSleeve: NM/); assert.match(saved.listing.description, /A1 Song/);
});
test('music edits use the parent draft rather than a competing direct stock save', () => { const source = readFileSync('src/components/features/MusicItemSpecifics.tsx', 'utf8'); assert.doesNotMatch(source, /\.from\('items'\)|save\.mutate|run preflight/); assert.match(source, /onChanged\(form.getValues\(\)\)/); });


test('vinyl category 176985 uses only its live New/Used policy, not generic Very Good condition', () => {
  const policy = contract.normalizeEbayConditionPolicy({
    categoryId: '176985', itemConditionRequired: true,
    itemConditions: [{ conditionId: 1000, conditionDescription: 'New' }, { conditionId: 3000, conditionDescription: 'Used' }],
  }, '176985');
  assert.deepEqual(policy, { required: true, conditions: [{ id: '1000', label: 'New' }, { id: '3000', label: 'Used' }] });
  assert.equal(contract.supportedEbayCondition('4000', policy.conditions, policy.required), false);
  assert.equal(contract.supportedEbayCondition('3000', policy.conditions, policy.required), true);
  assert.equal(contract.supportedEbayCondition('1000', policy.conditions, policy.required), true);
  assert.equal(contract.supportedEbayCondition('', policy.conditions, policy.required), false);
  assert.equal(contract.ebayMusicGrade('VG+'), 'Very Good Plus (VG+)');
});
test('condition lookup rejects a mismatched category or absent required choices', () => {
  assert.throws(() => contract.normalizeEbayConditionPolicy({
    categoryId: '176985', itemConditionRequired: true, itemConditions: [{ conditionId: '3000', conditionDescription: 'Used' }],
  }, '12345'), /policy for this category/);
  assert.throws(() => contract.normalizeEbayConditionPolicy({
    categoryId: '176985', itemConditionRequired: true, itemConditions: [],
  }, '176985'), /no choices/);
  assert.deepEqual(contract.normalizeEbayConditionPolicy({
    categoryId: '176985', itemConditionRequired: false, itemConditions: [],
  }, '176985'), { conditions: [], required: false });
});
test('web condition UI gets the current server policy and never offers unsupported saved grades as choices', () => {
  const metadata = readFileSync('src/hooks/useEbayCategoryMetadata.ts', 'utf8');
  const picker = readFileSync('src/components/features/ListingCategoryFields.tsx', 'utf8');
  const editor = readFileSync('src/pages/ListingEditor.tsx', 'utf8');
  assert.match(metadata, /route: 'get_condition_policies'/);
  assert.match(metadata, /'swish-ebay-list'/);
  assert.match(metadata, /normalizeEbayConditionPolicy/);
  assert.match(picker, /music \? \(conditions \?\? \[\]\)/);
  assert.match(picker, /invalidSavedCondition/);
  assert.match(picker, /Retry eBay condition lookup/);
  assert.match(editor, /supportedEbayCondition/);
  assert.match(editor, /!conditionReady/);
});


test('New/Used recovery is limited to the observed UK vinyl category and never auto-selects', () => {
  const recovery = contract.vinylConditionRecovery('176985', 'vinyl_records', true);
  assert.deepEqual(recovery, {
    conditions: [{ id: '1000', label: 'New' }, { id: '3000', label: 'Used' }],
    conditionRequired: true,
    source: 'observed-recovery',
  });
  assert.equal(contract.supportedEbayCondition('', recovery.conditions, recovery.conditionRequired), false);
  assert.equal(contract.supportedEbayCondition('4000', recovery.conditions, recovery.conditionRequired), false);
  assert.equal(contract.supportedEbayCondition('3000', recovery.conditions, recovery.conditionRequired), true);
  for (const [category, specialist, failed] of [
    ['176985', 'vinyl_records', false], ['176985', 'coins', true],
    ['176986', 'vinyl_records', true], ['', 'vinyl_records', true],
  ]) {
    assert.equal(contract.vinylConditionRecovery(category, specialist, failed), null);
  }
});
test('vinyl recovery works without metadata.isError and keeps the server as final verifier', () => {
  const editor = readFileSync('src/pages/ListingEditor.tsx', 'utf8');
  const picker = readFileSync('src/components/features/ListingCategoryFields.tsx', 'utf8');
  const source = readFileSync('src/hooks/useListingEditorActions.ts', 'utf8');
  const metadata = readFileSync('src/hooks/useEbayCategoryMetadata.ts', 'utf8');
  assert.match(metadata, /enabled: Boolean\(userId && tenantId && categoryId\)/);
  assert.match(editor, /vinylConditionRecovery\(categoryId/);
  assert.match(editor, /!metadata\.data/);
  assert.doesNotMatch(editor, /vinylConditionRecovery\([\s\S]*metadata\.isError/);
  assert.match(editor, /metadata\.data \?\? recoveryPolicy/);
  assert.match(editor, /const needsMusicConditionCheck = music/);
  assert.match(editor, /Boolean\(categoryId && conditionPolicy/);
  assert.match(editor, /supportedEbayCondition/);
  assert.match(picker, /recoveryPolicy/);
  assert.match(picker, /not freshly verified/);
  assert.match(picker, /No saved eBay category ID/);
  assert.doesNotMatch(picker, /eBay condition choices could not be verified\. Retry before submitting/);
  assert.match(source, /'swish-ebay-list'/);
  assert.match(source, /route: 'publish'/);
});

test('Vinyl Records category 176985 is usable while metadata is loading, disabled or failed', () => {
  for (const missingLiveData of [true]) {
    const recovery = contract.vinylConditionRecovery('176985', 'vinyl_records', missingLiveData);
    assert.deepEqual(recovery.conditions.map(row => row.id), ['1000', '3000']);
    assert.equal(contract.supportedEbayCondition('', recovery.conditions, recovery.conditionRequired), false);
    assert.equal(contract.supportedEbayCondition('4000', recovery.conditions, recovery.conditionRequired), false);
    assert.equal(contract.supportedEbayCondition('3000', recovery.conditions, recovery.conditionRequired), true);
  }
  assert.equal(contract.vinylConditionRecovery('176985', 'vinyl_records', false), null);
  assert.equal(contract.vinylConditionRecovery('', 'vinyl_records', true), null);
});
