import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
const module = async path => import(`data:text/javascript;base64,${Buffer.from(compile(await readFile(path, 'utf8')).outputText).toString('base64')}`);
const { normalizeProductBarcode } = await module('src/lib/productBarcode.ts');
const { parseNumistaNumber, captureNumistaReference, numistaVisualCandidates } = await module('src/lib/numistaCapture.ts');
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
  const [ui, scanner, lookup, camera] = await Promise.all(['src/components/features/BarcodeCapture.tsx', 'src/hooks/useBarcodeScanner.ts', 'src/hooks/useBarcodeLookup.ts', 'src/hooks/useCaptureCamera.ts'].map(path => readFile(path, 'utf8')));
  assert.match(ui, /lookup\.lookup\(reading\)/);
  assert.match(scanner, /decodeBarcodeImage\(frame/); assert.doesNotMatch(scanner, /getUserMedia|decodeFromVideoDevice/);
  assert.match(lookup, /flight\.current/); assert.match(lookup, /barcode_lookup/); assert.match(lookup, /captured\.isCurrent/);
  assert.match(camera, /attachVideo/); assert.match(camera, /visibilitychange/); assert.match(camera, /getTracks\(\).*track\.stop/);
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
  for (const path of ['src/hooks/useCaptureCamera.ts', 'src/hooks/useCameraDialog.ts', 'src/hooks/useBarcodeScanner.ts', 'src/hooks/useBarcodeLookup.ts', 'src/hooks/useCaptureEvidence.ts', 'src/lib/barcodeDecoder.ts', 'src/lib/numistaCapture.ts', 'src/components/features/SharedCaptureCamera.tsx', 'src/components/features/CameraViewport.tsx', 'src/components/features/CameraControls.tsx', 'src/components/features/BarcodeCapture.tsx', 'src/components/features/CaptureCamera.tsx', 'src/components/features/NumistaCaptureReview.tsx', 'src/components/features/NumistaReferenceEntry.tsx', 'src/components/features/QuickCaptureWorkspace.tsx', 'src/lib/quickCaptureFlow.ts', 'src/lib/capturePersistence.ts', 'src/components/features/CaptureDraftReview.tsx']) assert.equal(compile(await readFile(path, 'utf8')).diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0, path);
});
