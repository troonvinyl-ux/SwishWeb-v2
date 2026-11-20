import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map();
function load(path) { if (cache.has(path)) return cache.get(path); const module = { exports: {} }, code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText; new Function('require', 'module', 'exports', code)(name => name === '@/lib/captureRequest' ? { captureRecord: value => value && typeof value === 'object' && !Array.isArray(value) ? value : {} } : name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name), module, module.exports); cache.set(path, module.exports); return module.exports; }
const { listingConflicts } = load('src/lib/listingConflicts.ts'), { amendListingConflict } = load('src/lib/amendListingConflict.ts');
const item = { id: 'stock', specialist_id: 'vinyl_records', attributes: { media_grade: 'VG+', sleeve_grade: 'VG', play_tested: false, ebay_item_specifics: [{ name: 'Record Grading', value: 'VG+' }], _music_tracklisting: [{ position: 'A1', title: 'Full Track', duration: '3:10' }, { position: 'B1', title: 'Other Track', duration: '4:20' }] } };
const form = { title: 'Album Vinyl Record', category: 'Vinyl Records', category_id: '176985', condition: 'Used - Good', condition_id: '5000', description: 'Release details\nCondition\nMedia: VG\nSleeve: VG\nSeller confirms this item has been play-tested.\n\nTracklisting\nA1 Full Track (3:10)\n\nPlease review the seller’s own photographs for condition.' };
test('actual media mismatch asks which is correct; confidence alone asks no invented question', () => {
  const conflicts = listingConflicts(form, item, ['Low AI confidence (0%)']); assert.equal(conflicts.length, 1); assert.equal(conflicts[0].field, 'media_grade'); assert.deepEqual(conflicts[0].options.map(option => option.value), ['VG+', 'VG']);
  assert.equal(listingConflicts({ ...form, description: 'Media: VG+\nSleeve: VG' }, item, ['Low AI confidence (0%)']).length, 0);
});
test('selected media grade updates labelled text and retains category, condition, sleeve and tracks', () => {
  const conflict = listingConflicts(form, item, [])[0], result = amendListingConflict(form, item, conflict, { value: 'VG+', notes: '' });
  assert.match(result.form.description, /Media: VG\+\nSleeve: VG/); assert.match(result.form.description, /A1 Full Track \(3:10\)/);
  assert.equal(result.form.category_id, '176985'); assert.equal(result.form.condition_id, '5000'); assert.equal(result.form.condition, 'Used - Good'); assert.deepEqual(result.confirmedMusic, { media_grade: 'VG+' });
  assert.throws(() => amendListingConflict(form, item, conflict, { value: 'Rare and perfect', notes: '' }));
});
test('sleeve correction never replaces media grade or arbitrary grade references', () => {
  const next = { ...form, description: 'Media: VG+\nSleeve: G+\nComparable VG+ copies exist.' }, conflict = listingConflicts(next, item, []).find(value => value.field === 'sleeve_grade');
  const corrected = amendListingConflict(next, item, conflict, { value: 'VG', notes: '' }); assert.equal(corrected.form.description, 'Media: VG+\nSleeve: VG\nComparable VG+ copies exist.');
});
test('playback confirmation requires real notes and changes no unrelated conflicting grade', () => {
  const conflict = listingConflicts(form, item, ["Unverifiable claim: 'Seller confirms this item has been play-tested' lacks specific audio details."]).find(value => value.field === 'play_tested');
  assert.throws(() => amendListingConflict(form, item, conflict, { value: 'yes', notes: '' }));
  const no = amendListingConflict(form, item, conflict, { value: 'no', notes: '' }); assert.match(no.form.description, /Not play-tested/); assert.doesNotMatch(no.form.description, /Seller confirms/); assert.match(no.form.description, /Media: VG\n/);
  const yes = amendListingConflict(form, item, conflict, { value: 'yes', notes: 'Both sides played; surface noise heard between tracks.' }); assert.match(yes.form.description, /surface noise/); assert.doesNotMatch(yes.form.description, /turntable|perfect audio/i); assert.equal(yes.confirmedMusic.play_tested, true);
});
test('complete saved tracklisting restores omitted tracks and preserves other seller text', () => {
  const conflict = listingConflicts(form, item, ['Incomplete information: Tracklisting is truncated.']).find(value => value.field === 'tracklisting');
  const corrected = amendListingConflict(form, item, conflict, { value: 'saved', notes: '' }); assert.match(corrected.form.description, /B1 Other Track \(4:20\)/); assert.match(corrected.form.description, /Please review the seller/); assert.match(corrected.form.description, /Release details/);
});
test('conflict helpers remain factual utilities but are no longer a submission gate', () => {
  const source = readFileSync('src/hooks/useListingEditorActions.ts', 'utf8');
  assert.doesNotMatch(source, /amendListingConflict|preflight|verifiedRevision|swish-verify/);
  assert.doesNotMatch(readFileSync('src/lib/amendListingConflict.ts', 'utf8'), /human_override|route: 'publish'|pressing_reviewed: true/);
});
