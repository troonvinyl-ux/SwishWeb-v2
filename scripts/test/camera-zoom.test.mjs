import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
const helper = compile(await readFile('src/lib/cameraZoom.ts', 'utf8')).outputText;
const { cameraCrop, containedCameraSize, boundedCameraZoom, usableCameraRange, cameraCapabilities } = await import(`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`);
test('digital zoom crops the native frame without upscaling', () => {
  assert.deepEqual(cameraCrop(3840, 2160, 1), { x: 0, y: 0, width: 3840, height: 2160 });
  assert.deepEqual(cameraCrop(3840, 2160, 2), { x: 960, y: 540, width: 1920, height: 1080 });
  assert.deepEqual(cameraCrop(1920, 1080, 4), { x: 720, y: 405, width: 480, height: 270 });
  assert.deepEqual(cameraCrop(1080, 1920, 2), { x: 270, y: 480, width: 540, height: 960 });
  assert.deepEqual(cameraCrop(1920, 1080, Infinity), cameraCrop(1920, 1080, 1));
  assert.deepEqual(cameraCrop(1920, 1080, 20), cameraCrop(1920, 1080, 4));
  assert.throws(() => cameraCrop(0, 1080, 1), /usable camera frame/);
});
test('preview containment respects portrait and landscape without clipping the sensor image', () => {
  assert.deepEqual(containedCameraSize(1920, 1080, 400, 700), { width: 400, height: 225 });
  assert.deepEqual(containedCameraSize(1080, 1920, 400, 640), { width: 360, height: 640 });
  assert.deepEqual(containedCameraSize(0, 0, 400, 640), { width: 0, height: 0 });
});
test('hardware ranges are validated and zoom is clamped and snapped to the supported step', () => {
  assert.equal(usableCameraRange({ min: 1, max: 1 }), null);
  assert.equal(usableCameraRange({ min: 1, max: Infinity }), null);
  const range = usableCameraRange({ min: 1, max: 5, step: 0.5 });
  assert.equal(boundedCameraZoom(1.8, range), 2);
  assert.equal(boundedCameraZoom(100, range), 5);
  assert.equal(boundedCameraZoom(-10, range), 1);
  assert.equal(boundedCameraZoom(NaN, range), 1);
});
test('Safari-style absent or refused capability APIs fall back without breaking capture', () => {
  assert.equal(cameraCapabilities(null).zoom, undefined);
  assert.equal(cameraCapabilities({}).zoom, undefined);
  assert.deepEqual(cameraCapabilities({ getCapabilities() { throw new Error('Unsupported'); } }), {});
  assert.deepEqual(cameraCapabilities({ getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 0.1 }, focusMode: ['continuous'] }) }).focusMode, ['continuous']);
});
test('the actual coin scanner uses the shared zoom-enabled camera, not a separate stream', async () => {
  const identify = await readFile('src/pages/Identify.tsx', 'utf8');
  const dialog = await readFile('src/components/features/CoinCaptureDialog.tsx', 'utf8');
  assert.match(identify, /<CoinCaptureDialog/);
  assert.doesNotMatch(identify, /cameraStreamRef|cameraVideoRef|captureCameraImage|startCamera/);
  assert.match(dialog, /SharedCaptureCamera/); assert.match(dialog, /autoStart/);
});
test('shared zoom changes the captured crop, supports continuous focus and serializes hardware settings', async () => {
  const [camera, preview, settings, zoom, shared, photo, canvas] = await Promise.all(['src/hooks/useCaptureCamera.ts', 'src/components/features/CameraPreview.tsx', 'src/hooks/useCameraAdjustments.ts', 'src/components/features/CameraZoomControls.tsx', 'src/components/features/SharedCaptureCamera.tsx', 'src/lib/captureCameraPhoto.ts', 'src/lib/cameraPhotoCanvas.ts'].map(path => readFile(path, 'utf8')));
  assert.match(camera, /captureCameraPhoto\(element, track, adjustments.digitalZoom/);
  assert.match(photo, /cameraCrop\(width, height, zoom\)/); assert.match(photo, /cameraPhotoCrop/);
  assert.match(canvas, /Math.min\(1, Math.sqrt/); assert.match(canvas, /crop.x, crop.y, crop.width, crop.height/);
  assert.match(preview, /containedCameraSize/); assert.match(preview, /cameraCrop/);
  assert.match(settings, /focusMode: mode/); assert.match(settings, /'continuous'/);
  assert.match(settings, /worker.current === track/); assert.match(settings, /queued.current/);
  assert.match(settings, /setDigital\(true\)/); assert.match(shared, /CameraZoomControls/);
  assert.match(zoom, /Digital crop/); assert.match(zoom, /Zoom out/); assert.match(zoom, /Zoom in/); assert.match(zoom, /does not add detail/);
});
test('camera zoom files have no TypeScript syntax diagnostics', async () => {
  for (const path of ['src/types/camera.ts', 'src/lib/cameraZoom.ts', 'src/lib/cameraStream.ts', 'src/lib/cameraStill.ts', 'src/lib/cameraPhotoCanvas.ts', 'src/lib/captureCameraPhoto.ts', 'src/hooks/useCameraStream.ts', 'src/components/features/CameraSourceControls.tsx', 'src/hooks/useCameraAdjustments.ts', 'src/hooks/useCaptureCamera.ts', 'src/components/features/CameraPreview.tsx', 'src/components/features/CameraViewport.tsx', 'src/components/features/CameraControls.tsx', 'src/components/features/CameraZoomControls.tsx', 'src/components/features/CoinCaptureDialog.tsx', 'src/components/features/SharedCaptureCamera.tsx', 'src/pages/Identify.tsx']) {
    const result = compile(await readFile(path, 'utf8'));
    assert.equal(result.diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length ?? 0, 0, path);
  }
});
