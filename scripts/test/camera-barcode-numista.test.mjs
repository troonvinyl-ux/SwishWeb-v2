import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
const module = async path => import(`data:text/javascript;base64,${Buffer.from(compile(await readFile(path, 'utf8')).outputText).toString('base64')}`);
const { normalizeProductBarcode } = await module('src/lib/productBarcode.ts');
const numistaModule = await module('src/lib/numistaCapture.ts');
const { parseNumistaNumber, captureNumistaReference, numistaVisualCandidates } = numistaModule;
test('EAN, UPC-E and ISBN use native normalization; URLs are never fetched', () => {
  assert.equal(normalizeProductBarcode('4006381333931'), '4006381333931');
  assert.equal(normalizeProductBarcode('04210007', 'upc_e'), '042000001007');
  assert.equal(normalizeProductBarcode('0306406152'), '9780306406157');
  assert.equal(normalizeProductBarcode('4006381333932'), null);
  assert.equal(normalizeProductBarcode('https://example.com/private', 'qr'), null);
});
test('Numista references validate IDs and do not certify the physical item', () => {
  assert.equal(parseNumistaNumber('N#12345'), 12345);
  assert.equal(parseNumistaNumber('https://en.numista.com/catalogue/pieces12345.html'), 12345);
  assert.equal(parseNumistaNumber('https://evil.example/catalogue/pieces12345.html'), null);
  assert.equal(parseNumistaNumber('0'), null);
  assert.equal(captureNumistaReference({ numistaTypeId: 77 }, 'N#12345').source, 'seller_reference');
  assert.equal(captureNumistaReference({ numistaTypeId: 77 }).numistaN, 'N#77');
  assert.equal(numistaVisualCandidates({ candidates: [{ typeId: 77, title: 'Candidate', rank: 1, url: 'javascript:alert(1)' }] })[0].url, 'https://en.numista.com/catalogue/pieces77.html');
});
test('barcode read starts exactly one scoped lookup and decoding uses the existing video snapshots', async () => {
  const [ui, scanner, lookup, camera, lifecycle] = await Promise.all(['src/components/features/BarcodeCapture.tsx', 'src/hooks/useBarcodeScanner.ts', 'src/hooks/useBarcodeLookup.ts', 'src/hooks/useCameraStream.ts', 'src/lib/cameraStream.ts'].map(path => readFile(path, 'utf8')));
  assert.match(ui, /lookup\.lookup\(reading\)/);
  assert.match(scanner, /decodeBarcodeImage\(video.current/); assert.doesNotMatch(scanner, /getUserMedia|decodeFromVideoDevice/);
  assert.match(lookup, /flight\.current/); assert.match(lookup, /barcode_lookup/); assert.match(lookup, /captured\.isCurrent/);
  assert.match(camera, /attachVideo/); assert.match(camera, /visibilitychange/); assert.match(lifecycle, /getTracks\(\).*track\.stop/);
});
test('Numista uses original bounded coin faces and carries a reference, not a catalogue clone, into draft review', async () => {
  const [pipeline, persistence, review] = await Promise.all(['src/lib/quickCaptureFlow.ts', 'src/lib/capturePersistence.ts', 'src/components/features/CaptureDraftReview.tsx'].map(path => readFile(path, 'utf8')));
  assert.match(pipeline, /numistaImages/); assert.match(pipeline, /captureNumistaReference/);
  assert.match(persistence, /numista_type_id/); assert.match(review, /NumistaCaptureReview/);
  assert.doesNotMatch(pipeline, /route: 'publish'/);
});
test('camera is one accessible full-screen stream with native Library, shutter and Review controls', async () => {
  const [shared, controls] = await Promise.all(['src/components/features/SharedCaptureCamera.tsx', 'src/components/features/CameraControls.tsx'].map(path => readFile(path, 'utf8')));
  assert.match(shared, /createPortal\(view, document\.body\)/); assert.match(shared, /aria-modal/); assert.match(shared, /useCameraDialog/);
  assert.match(controls, /Take photograph/); assert.match(controls, /Library/); assert.match(controls, /Review/);
});
test('camera and scanner changes have no TypeScript syntax diagnostics', async () => {
  for (const path of ['src/hooks/useCaptureCamera.ts', 'src/hooks/useCameraStream.ts', 'src/hooks/useCameraDialog.ts', 'src/hooks/useBarcodeScanner.ts', 'src/hooks/useBarcodeLookup.ts', 'src/hooks/useCaptureEvidence.ts', 'src/lib/barcodeDecoder.ts', 'src/lib/numistaCapture.ts', 'src/components/features/SharedCaptureCamera.tsx', 'src/components/features/CameraViewport.tsx', 'src/components/features/CameraControls.tsx', 'src/components/features/BarcodeCapture.tsx', 'src/components/features/CaptureCamera.tsx', 'src/components/features/NumistaCaptureReview.tsx', 'src/components/features/NumistaReferenceEntry.tsx', 'src/components/features/QuickCaptureWorkspace.tsx', 'src/lib/quickCaptureFlow.ts', 'src/lib/capturePersistence.ts', 'src/components/features/CaptureDraftReview.tsx']) assert.equal(compile(await readFile(path, 'utf8')).diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0, path);
});


test('seller N#438449 is normalized into fields the existing swish-identify direct lookup reads', () => {
  const { numistaIdentifyKnownAttributes } = numistaModule;
  assert.equal(parseNumistaNumber(' N#438449 '), 438449);
  const fields = numistaIdentifyKnownAttributes(' N#438449 ');
  assert.equal(fields.catalogueNumber, 'N#438449');
  assert.equal(fields.numistaN, 'N#438449');
  assert.equal(fields.numistaTypeId, 438449);
  assert.match(fields.customNotes, /Seller-supplied Numista N#438449/);
});
test('seller Numista catalogue record cannot be replaced by contradictory image-AI candidate', () => {
  const { numistaAnchoredReview } = numistaModule;
  const source = {
    identification: { title: 'Ancient Greek Silver Stater, possibly Corinthian', confidence: 0.96 },
    numistaVerification: {
      typeId: 438449, title: 'Retrieved Numista catalogue title',
      matchFactors: ['Exact user-supplied catalogue reference N#438449 retrieved directly from Numista API'],
      contradictions: [],
    },
  };
  const review = numistaAnchoredReview(source, [{ title: 'Ancient Greek Silver Stater, possibly Corinthian', confidence: 0.96 }], 'N#438449');
  assert.equal(review.candidates.length, 1);
  assert.equal(review.candidates[0].title, 'Retrieved Numista catalogue title');
  assert.equal(review.candidates[0].reference, 'N#438449');
  assert.equal(review.visualConflict, true);
  assert.equal(review.catalogueRetrieved, true);
  assert.ok(review.candidates[0].confidence < 0.5);
});
test('unavailable or mismatched catalogue lookup never invents catalogue facts', () => {
  const { numistaAnchoredReview } = numistaModule;
  for (const verification of [{ status: 'unavailable' }, {
    typeId: 777, title: 'Unrelated catalogue type',
    matchFactors: ['Exact user-supplied catalogue reference N#777 retrieved directly from Numista API'],
  }]) {
    const review = numistaAnchoredReview(
      { identification: { title: 'Greek coin' }, numistaVerification: verification },
      [{ title: 'Greek coin', country: 'Greece' }], 'N#438449',
    );
    assert.match(review.candidates[0].title, /Seller-supplied Numista reference N#438449/);
    assert.equal(review.candidates[0].country, undefined);
    assert.equal(review.catalogueRetrieved, false);
    assert.equal(review.candidates[0].numista_url, 'https://en.numista.com/catalogue/pieces438449.html');
  }
});
test('invalid or missing Numista references keep normal visual identification flow', () => {
  const { numistaAnchoredReview, numistaIdentifyKnownAttributes } = numistaModule;
  const visual = [{ title: 'A coin identified visually' }];
  for (const entry of [undefined, '', 'N#invalid', '438449?']) {
    assert.deepEqual(numistaIdentifyKnownAttributes(entry), {});
    assert.deepEqual(numistaAnchoredReview({}, visual, entry).candidates, visual);
  }
});
test('Coin Flipper's active /scan/coins route retains two-face capture and existing draft gates', async () => {
  const [app, identify, gate] = await Promise.all([
    'src/App.tsx', 'src/pages/Identify.tsx', 'src/lib/coinListingGate.ts',
  ].map(path => readFile(path, 'utf8')));
  assert.match(app, /path="\\/scan\\/coins" element=\\{<Identify \\/>\\}/);
  assert.match(identify, /const canSubmit = !!obverse && !!reverse/);
  assert.match(identify, /numistaIdentifyKnownAttributes\\(metadata\\.numista_number\\)/);
  assert.match(identify, /numistaAnchoredReview\\(identResult, normalizedCandidates, metadata\\.numista_number\\)/);
  assert.match(identify, /createCoinListingDraft/);
  assert.match(gate, /faces\\.has\\('obverse'\\).*faces\\.has\\('reverse'\\)/);
  assert.match(gate, /positiveMeasurement\\(answers\\.weight\\)/);
  assert.match(gate, /positiveMeasurement\\(answers\\.diameter\\)/);
  assert.match(gate, /parseNumistaNumber\\(answers\\.numista_number\\)/);
});
