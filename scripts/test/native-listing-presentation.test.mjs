import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
function pure(path) { const mod = { exports: {} }, result = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }); new Function('module', 'exports', result.outputText)(mod, mod.exports); return mod.exports; }
const { listingTab, listingDescriptionText } = pure('src/lib/listingPresentation.ts');
test('listing lifecycle presents pending claims as attention, not a second draft publication', () => {
  assert.equal(listingTab({ status: 'active', publish_claim_id: 'claim' }), 'attention');
  assert.equal(listingTab({ status: 'live' }), 'live'); assert.equal(listingTab({ status: 'verified' }), 'draft');
  assert.equal(listingTab({ status: 'failed' }), 'attention'); assert.equal(listingTab({ status: 'sold' }), 'sold');
});
test('buyer preview displays text without rendering scripts, styles or raw HTML', () => {
  assert.equal(listingDescriptionText('<script>bad()</script><style>body{}</style><p>Album &amp; sleeve</p>'), 'Album & sleeve');
  assert.equal(listingDescriptionText('&#x1F3B5; &#65; &nbsp;'), '🎵 A');
  assert.equal(listingDescriptionText('&#999999999;'), '&#999999999;');
});
test('native-style review keeps the GitHub shell, price editing, saved-photo rail and evidence separation', () => {
  const editor = readFileSync('src/pages/ListingEditor.tsx', 'utf8');
  assert.match(editor, /flip-overview-grid/); assert.match(editor, /ListingReadySummary/); assert.match(editor, /ListingQuickPrice/); assert.match(editor, /ListingPublishConfirmation/);
  assert.doesNotMatch(editor, /manual-listing-status/);
  const summary = readFileSync('src/components/features/ListingReadySummary.tsx', 'utf8');
  assert.match(summary, /Research evidence, not a guaranteed sale price/); assert.match(summary, /overflow-x-auto/); assert.match(summary, /listingDescriptionText/);
  assert.match(readFileSync('src/hooks/useListingCollection.ts', 'utf8'), /useSearchParams/);
});
test('new infrastructure and listing modules have no syntax diagnostics', () => {
  for (const path of ['lib/backendRequests.ts','lib/backendReadQueue.ts','lib/moduleScope.ts','lib/backendAvailability.ts','lib/acceptedPublication.ts','lib/listingClarification.ts','lib/listingPresentation.ts','hooks/useListingCollection.ts','pages/Listings.tsx','components/features/ListingReadySummary.tsx','components/features/ListingQuickPrice.tsx','components/features/ListingCollectionCard.tsx','components/features/ListingPublishConfirmation.tsx']) {
    const result = ts.transpileModule(readFileSync(`src/${path}`, 'utf8'), { fileName: path, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
    assert.deepEqual(result.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error) || [], [], path);
  }
});
