import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
function load(path) { const module = { exports: {} }; const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true }); assert.equal(compiled.diagnostics?.filter(value => value.category === ts.DiagnosticCategory.Error).length || 0, 0); new Function('module', 'exports', compiled.outputText)(module, module.exports); return module.exports; }
const { confirmedPublicationRejection, rejectedAttemptCanRetry, readPublicationReservation } = load('src/lib/publicationRecovery.ts');
const { parseListingVerification } = load('src/lib/listingVerification.ts');
const { syncMusicConditionText } = load('src/lib/musicConditionText.ts');
const draft = { id: 'listing', tenant_id: 'tenant', status: 'verified', publish_claim_id: null, external_listing_id: null };
test('explicit no-submission responses can be recovered, not bare HTTP errors', () => {
  assert.equal(confirmedPublicationRejection({ status: 422, body: { error: 'Missing required field', publicationAttempted: false } }), true);
  assert.equal(confirmedPublicationRejection({ status: 400, body: { error: 'No eBay request was sent.' } }), true);
  for (const response of [{ status: 400, body: { error: 'Bad request' } }, { status: 0, body: null }, { status: 500, body: { error: 'Server error', accepted: false } }, { status: 422, body: { error: 'Needs inspection', publicationAttempted: false } }, { status: 400, body: { error: 'Rejected', accepted: true, publicationAttempted: false } }, { status: 400, body: { error: 'Rejected', accepted: false, publicationUnconfirmed: true } }]) assert.equal(confirmedPublicationRejection(response), false);
});
test('retry needs confirmed rejection, fresh correct scope and explicit absent claim', () => {
  assert.equal(rejectedAttemptCanRetry({ version: 2, outcome: 'rejected' }, draft, 'tenant', 'listing'), true);
  for (const row of [{ ...draft, publish_claim_id: 'pending' }, { ...draft, external_listing_id: '123' }, { ...draft, published_at: '2026-11-20' }, { ...draft, tenant_id: 'other' }, { ...draft, id: 'other' }, { ...draft, status: 'active' }, { id: 'listing', tenant_id: 'tenant', status: 'draft' }]) assert.equal(rejectedAttemptCanRetry({ version: 2, outcome: 'rejected' }, row, 'tenant', 'listing'), false);
  for (const outcome of ['pending', 'uncertain', 'published']) assert.equal(rejectedAttemptCanRetry({ version: 2, outcome }, draft, 'tenant', 'listing'), false);
});
test('old browser timestamps never become retry permission', () => {
  assert.equal(readPublicationReservation(null), null);
  assert.equal(readPublicationReservation('2026-11-19T03:00:00Z').outcome, 'uncertain');
  assert.equal(readPublicationReservation('{invalid').outcome, 'uncertain');
});
test('nested native verification passes despite advisory warnings, never genuine failures', () => {
  assert.deepEqual(parseListingVerification({ verification: { overall_passed: true, warnings: ['Low AI confidence (0%)'], failure_reasons: [] } }), { passed: true, warnings: ['Low AI confidence (0%)'], failures: [], human: false });
  assert.equal(parseListingVerification({ passed: true, failure_reasons: ['Item sold'] }).passed, false);
  assert.equal(parseListingVerification({ passed: false, verification: { overall_passed: true } }).passed, false);
  assert.equal(parseListingVerification({ passed: true, override: true }).human, true);
});
test('media/sleeve sync preserves full tracks and never invents playback equipment', () => {
  const original = 'Condition\nMedia: VG+\nSleeve: VG\nSeller confirms this item has been play-tested.\n\nTracklisting\nA1 Song (3:10)\nB1 Other (4:20)';
  const next = syncMusicConditionText(original, { media_grade: 'VG', sleeve_grade: 'G+', play_tested: true });
  assert.match(next, /Media: VG\nSleeve: G\+/); assert.match(next, /B1 Other \(4:20\)/); assert.match(next, /not a guarantee/); assert.doesNotMatch(next, /turntable|perfect audio/i);
  assert.equal(syncMusicConditionText('Seller custom text and condition claims.', { media_grade: 'NM', sleeve_grade: 'NM', play_tested: false }), 'Seller custom text and condition claims.');
});
test('vinyl guide is larger, options collapsed, and full original capture stays unchanged', () => {
  assert.match(readFileSync('src/components/features/MusicEvidencePanel.tsx', 'utf8'), /record=\{/);
  assert.match(readFileSync('src/components/features/CameraPreview.tsx', 'utf8'), /record \? 0\.9 : 0\.72/);
  assert.match(readFileSync('src/components/features/SharedCaptureCamera.tsx', 'utf8'), /open=\{record && !barcode \? undefined : true\}/);
  assert.match(readFileSync('src/components/features/captureCamera.css', 'utf8'), /capture-frame\.is-record/);
});
test('direct submission no longer uses seller overrides or browser locks; status recovery never publishes', () => {
  const editor = readFileSync('src/hooks/useListingEditorActions.ts', 'utf8');
  assert.match(editor, /route: 'publish'/);
  assert.doesNotMatch(editor, /human_override|swish-verify|attempt\.settle|attempt\.reserve|sessionStorage/);
  assert.match(readFileSync('src/lib/listingStatusRecovery.ts', 'utf8'), /swish-ebay-listing-status/);
  assert.doesNotMatch(readFileSync('src/lib/listingStatusRecovery.ts', 'utf8'), /route: 'publish'|swish_create_listing_draft/);
});
