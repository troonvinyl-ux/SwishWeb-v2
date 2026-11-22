import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const literalUrl = uri(compile(await readFile('src/lib/nativeSourceLiteral.ts', 'utf8')).outputText);
const { sourceArray, parseNativeLiteral } = await import(literalUrl);
const profileCode = compile(await readFile('src/lib/nativeCaptureProfiles.ts', 'utf8')).outputText.replace('@/lib/nativeSourceLiteral', literalUrl);
const { parseCaptureProfile, modeCaptureSlots } = await import(uri(profileCode));
const { normalizeProductBarcode } = await import(uri(compile(await readFile('src/lib/productBarcode.ts', 'utf8')).outputText));
const specialists = `\n stamps: { captureRequirements: [\n { id: 'front', label: 'Stamp front', description: 'Full [stamp] and cover', required: true },\n // This comment has [ ] brackets\n { id: 'gum', label: 'Gum', description: 'Safe reverse inspection', required: false },\n ], capabilities: {} },\n coins: { captureRequirements: [] }`;
const intelligence = `\n stamps: { focus: 'Issue first', modes: [{id:'item',label:'Stamp / set'},{id:'cover',label:'Postal history'}], fields: [field('gum','Gum / hinge'),field('sg_number','SG reference','Catalogue')] },\n coins: { fields: [] }`;
test('configuration literals preserve brackets in descriptions and never execute expressions', () => {
  const parsed = parseNativeLiteral(sourceArray(specialists, 'captureRequirements'));
  assert.equal(parsed.length, 2); assert.equal(parsed[0].description, 'Full [stamp] and cover');
  assert.throws(() => parseNativeLiteral('[process.exit()]'));
  assert.throws(() => parseNativeLiteral('{__proto__:true}'));
});
test('Stamp Flip uses native views, fields, modes and no retail barcode', () => {
  const profile = parseCaptureProfile(specialists, intelligence, 'stamps', 'stamps');
  assert.equal(profile.barcode, 'disabled'); assert.equal(profile.fields[1].key, 'sg_number');
  assert.equal(profile.modes[1].id, 'cover'); assert.equal(profile.slots.find(slot => slot.id === 'back').required, true);
});
test('missing native configuration fails closed instead of borrowing coin capture', () => {
  assert.throws(() => parseCaptureProfile(specialists, intelligence, 'stamps', 'missing'));
});
test('parts and multi-disc modes require the same native evidence', () => {
  const profile = parseCaptureProfile(specialists, intelligence, 'stamps', 'stamps');
  assert.deepEqual(modeCaptureSlots(profile, 'bicycles', 'part').filter(slot => slot.required).map(slot => slot.id), ['main', 'part_number', 'back']);
  assert.deepEqual(modeCaptureSlots(profile, 'tunes_flip', 'cd_box_set', '2').map(slot => slot.id), ['front_sleeve', 'back_sleeve', 'disc_count', 'disc_1', 'disc_2']);
});
test('barcodes require valid checksums; arbitrary QR URLs cannot become fetch targets', () => {
  assert.equal(normalizeProductBarcode('4006381333931'), '4006381333931');
  assert.equal(normalizeProductBarcode('4006381333932'), null);
  assert.equal(normalizeProductBarcode('https://example.com/secret'), null);
  assert.equal(normalizeProductBarcode('0306406152'), '9780306406157');
});
test('each active scanner route has an explicit scoped flow that saves evidence without publishing', async () => {
  const [app, capture, pipeline, persistence, review, coin] = await Promise.all([
    'src/App.tsx', 'src/pages/NicheCapture.tsx', 'src/lib/quickCaptureFlow.ts',
    'src/lib/capturePersistence.ts', 'src/components/features/CaptureDraftReview.tsx',
    'src/pages/Identify.tsx',
  ].map(path => readFile(path, 'utf8')));
  // The existing coin Numista workflow remains the production coin route.
  assert.ok(app.includes('path="/identify/coins" element={<Navigate to="/scan/coins" replace />}'));
  assert.ok(app.includes('path="/scan/coins" element={<Identify />}'));
  assert.ok(app.includes('path="/scan/:niche" element={<NicheCapture />}'));
  assert.ok(app.includes('path="/capture" element={<Navigate to='));
  assert.match(coin, /coinAllowed/);
  // Other niche scan routes persist the current tenant's items and original
  // images; they do not pretend to have created a marketplace listing.
  assert.match(capture, /useInsert\('items', tenantId\)/);
  assert.match(capture, /swish-identify/);
  assert.match(capture, /storage\.from\('item-images'\)\.upload/);
  assert.match(capture, /\.eq\('tenant_id',tenantId\)/);
  assert.doesNotMatch(capture, /route: 'publish'/);
  // The shared quick-capture service is separately tested for durable photos,
  // generation, and draft RPC, without asserting it replaces all niche flows.
  assert.match(pipeline, /swish-identify/);
  assert.match(pipeline, /swish-list-generate/);
  assert.match(pipeline, /swish_create_listing_draft/);
  assert.doesNotMatch(pipeline, /route: 'publish'/);
  assert.match(persistence, /swish-capture-v1/);
  assert.match(persistence, /item-images/);
  assert.match(review, /Save for later/);
  assert.match(review, /publish_claim_id/);
});

test('new scanner files transpile without syntax errors', async () => {
  for (const path of ['src/lib/nativeSourceLiteral.ts', 'src/lib/nativeCaptureProfiles.ts', 'src/lib/captureRequest.ts', 'src/lib/capturePersistence.ts', 'src/lib/quickCaptureFlow.ts', 'src/hooks/useQuickCapture.ts', 'src/hooks/useCaptureCamera.ts', 'src/components/features/QuickCaptureWorkspace.tsx', 'src/components/features/CaptureDraftReview.tsx', 'src/components/features/BarcodeCapture.tsx', 'src/components/features/CaptureCamera.tsx']) assert.equal(compile(await readFile(path, 'utf8')).diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0, path);
});
