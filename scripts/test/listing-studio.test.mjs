import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
function load(path, dependencies = {}) { const result = { exports: {} }; new Function('require', 'module', 'exports', compile(readFileSync(path, 'utf8')).outputText)(name => dependencies[name] || require(name), result, result.exports); return result.exports; }
const { isStudioSessionCurrent, moveStudioPhoto, assertStudioPhotoBudget, STUDIO_SESSION_TTL } = load('src/lib/listingStudioSession.ts');
const photo = id => ({ slotId: id, label: id, file: { size: 1 } });
test('temporary sessions require a matching signed-in account, tenant and unexpired timestamp', () => {
  const session = { userId: 'one', tenantId: 'tenant', updatedAt: 1000, photos: [photo('front')] };
  assert.equal(isStudioSessionCurrent(session, 'one', 'tenant', 2000), true);
  for (const [user, tenant, now] of [['two', 'tenant', 2000], ['one', 'other', 2000], ['', '', 2000], ['one', 'tenant', 1000 + STUDIO_SESSION_TTL], ['one', 'tenant', 900]]) assert.equal(isStudioSessionCurrent(session, user, tenant, now), false);
});
test('reordering preserves original file identities and known capture roles', () => {
  const photos = [photo('obverse'), photo('reverse'), photo('detail')];
  const moved = moveStudioPhoto(photos, 'reverse', -1);
  assert.deepEqual(moved.map(value => value.slotId), ['reverse', 'obverse', 'detail']); assert.equal(moved[0].file, photos[1].file);
  assert.equal(moveStudioPhoto(photos, 'obverse', -1), photos); assert.equal(moveStudioPhoto(photos, 'missing', 1), photos);
});
test('original retention has explicit count and memory limits', () => {
  assert.doesNotThrow(() => assertStudioPhotoBudget([photo('front')]));
  assert.throws(() => assertStudioPhotoBudget(Array.from({ length: 9 }, (_, index) => photo(String(index)))), /eight/);
  assert.throws(() => assertStudioPhotoBudget([{ ...photo('front'), file: { size: 81 * 1024 * 1024 } }]), /80 MB/);
});
test('uncertain item saves are not replayed; existing draft lookup stays tenant scoped', async () => {
  let calls = 0;
  const { prepareStableQuickCapture } = load('src/lib/listingStudioPreparation.ts', { '@/lib/captureRequest': { assertCaptureScope: async () => undefined }, '@/lib/quickCaptureFlow': { prepareQuickCapture: async () => { calls++; return {}; } } });
  await assert.rejects(prepareStableQuickCapture({ scope: {}, checkpoint: { itemAttempted: true }, onCheckpoint() {}, onProgress() {} }), /uncertain/); assert.equal(calls, 0);
  const source = readFileSync('src/lib/listingStudioPreparation.ts', 'utf8');
  assert.match(source, /eq\('tenant_id', options.scope.tenantId\)/); assert.match(source, /publish_claim_id/); assert.match(source, /draftAttempted/);
});
test('quiet surface keeps guidance below the image and never alters captured evidence', () => {
  const surface = readFileSync('src/components/features/StudioCameraSurface.tsx', 'utf8'), css = readFileSync('src/components/features/listingStudio.css', 'utf8');
  assert.match(surface, /studio-camera-bottom/); assert.match(surface, /StudioGuidanceCard/); assert.match(surface, /camera.capabilities.torch/); assert.match(surface, /onDrop/);
  assert.match(css, /prefers-reduced-transparency/); assert.match(css, /safe-area-inset-bottom/); assert.match(css, /hsl\(var\(--studio-scrim\)\/\.58\)/);
  for (const path of ['src/lib/sharedScanPhotos.ts', 'src/lib/captureCameraPhoto.ts', 'src/lib/capturePersistence.ts']) assert.doesNotMatch(readFileSync(path, 'utf8'), /studio-scrim|studio-mask|backdropFilter/);
});
test('camera analysis and recovery reuse existing client and pipelines, not a new backend route', () => {
  const observation = readFileSync('src/hooks/useStudioObservation.ts', 'utf8'), page = readFileSync('src/pages/ListingStudio.tsx', 'utf8'), app = readFileSync('src/App.tsx', 'utf8');
  assert.match(observation, /'swish-identify'/); assert.match(observation, /assertCaptureScope/); assert.match(observation, /flight.abort/); assert.match(observation, /generation.current === token/); assert.match(observation, /6000000/);
  assert.doesNotMatch(observation, /route:\s*['"]studio_observe|createClient|service_role/); assert.match(page, /access.nicheIds.includes\(niche\)/);
  assert.match(app, /ListingStudioProvider/); assert.match(app, /path="\/studio"/); assert.match(app, /path="\/scan\/coins" element={<Identify/);
  assert.match(readFileSync('src/hooks/useMusicResearch.ts', 'utf8'), /field.source==='discogs'/);
});
test('studio files have no TypeScript syntax diagnostics', () => {
  for (const path of ['src/types/listingStudio.ts', 'src/lib/listingStudioSession.ts', 'src/lib/listingStudioGuidance.ts', 'src/lib/listingStudioPreparation.ts', 'src/contexts/ListingStudioContext.tsx', 'src/hooks/useStudioHandoff.ts', 'src/hooks/useStudioObservation.ts', 'src/hooks/useStudioPhotos.ts', 'src/pages/ListingStudio.tsx', 'src/pages/StudioReview.tsx', 'src/components/features/StudioCameraSurface.tsx', 'src/components/features/StudioGuidanceCard.tsx', 'src/components/features/StudioPhotoRail.tsx', 'src/components/features/StudioToolSheet.tsx', 'src/components/features/StudioNicheSelector.tsx', 'src/components/features/StudioResearchNotes.tsx']) assert.equal(compile(readFileSync(path, 'utf8')).diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
});
