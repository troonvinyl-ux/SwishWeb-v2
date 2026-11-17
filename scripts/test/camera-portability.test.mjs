import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { File as NodeFile } from 'node:buffer';
const ts = createRequire(import.meta.url)('typescript'), urls = new Map();
async function moduleURL(path) {
  if (urls.has(path)) return urls.get(path);
  let code = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const match of [...code.matchAll(/from ['"](@\/[^'"]+)['"]/g)]) code = code.replace(match[0], `from '${await moduleURL('src/' + match[1].slice(2) + '.ts')}'`);
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`; urls.set(path, url); return url;
}
const [stream, still, crop, photo] = await Promise.all(['src/lib/cameraStream.ts', 'src/lib/cameraStill.ts', 'src/lib/cameraZoom.ts', 'src/lib/captureCameraPhoto.ts'].map(async path => import(await moduleURL(path))));
async function platform(constructor, run) {
  const originals = new Map(), draws = []; let releases = 0;
  class MockImage { naturalWidth = 4000; naturalHeight = 3000; set src(value) { queueMicrotask(() => this.onload?.()); } }
  const values = { ImageCapture: constructor, Image: MockImage, File: NodeFile, URL: { createObjectURL: () => 'blob:test-camera', revokeObjectURL: () => releases++ }, document: { createElement: () => {
    const record = { version: null, coordinates: null }; draws.push(record);
    return { width: 0, height: 0, getContext: () => ({ drawImage: (source, ...coordinates) => { record.version = source.version ?? 'sensor'; record.coordinates = coordinates; } }), toBlob: callback => callback(new Blob([`frame-${record.version}`], { type: 'image/jpeg' })) };
  } } };
  for (const [key, value] of Object.entries(values)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  try { await run({ draws, released: () => releases }); }
  finally { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
test('high quality preview constraints are preferences, not mandatory dimensions', () => {
  const requested = stream.cameraVideoConstraints('environment');
  assert.equal(requested.facingMode.ideal, 'environment'); assert.equal(requested.width.ideal, 2560); assert.equal(requested.height.exact, undefined);
  assert.equal(stream.cameraVideoConstraints('environment', 'chosen-lens').deviceId.exact, 'chosen-lens');
});
test('unsupported constraints get one bounded fallback without audio', async () => {
  const requests = [], error = new Error('Unsupported'); error.name = 'OverconstrainedError';
  const result = await stream.requestCameraStream({ getUserMedia: async request => { requests.push(request); if (requests.length === 1) throw error; return 'stream'; } }, 'environment', 'lens');
  assert.equal(result, 'stream'); assert.equal(requests.length, 2); assert.equal(requests[1].audio, false); assert.deepEqual(requests[1].video, { facingMode: { ideal: 'environment' } });
});
test('denied permission and busy cameras are not retried automatically', async () => {
  for (const name of ['NotAllowedError', 'SecurityError', 'NotReadableError', 'AbortError']) {
    let requests = 0; const error = new Error(name); error.name = name;
    await assert.rejects(stream.requestCameraStream({ getUserMedia: async () => { requests++; throw error; } }, 'environment'), cause => cause === error);
    assert.equal(requests, 1); assert.match(stream.cameraErrorMessage(error), /camera/);
  }
});
test('stream release stops every track and detaches ended callbacks', () => {
  let stopped = 0; const tracks = [0, 1].map(() => ({ onended: () => undefined, stop: () => stopped++ }));
  stream.releaseCameraStream({ getTracks: () => tracks }); assert.equal(stopped, 2); assert.ok(tracks.every(track => track.onended === null)); stream.releaseCameraStream(null);
});
test('still resolution requests have a memory budget and do not force coin flash', () => {
  const settings = still.cameraPhotoSettings({ imageWidth: { max: 12000 }, imageHeight: { max: 9000 }, fillLightMode: ['off', 'flash'] });
  assert.ok(settings.imageWidth * settings.imageHeight <= still.MAX_CAMERA_PHOTO_PIXELS); assert.equal(settings.fillLightMode, 'off');
  assert.deepEqual(still.cameraPhotoSettings({ imageWidth: { max: Infinity } }), {});
});
test('sensor and preview aspect ratios share a centred digital crop without upscaling', () => {
  assert.deepEqual(crop.cameraPhotoCrop(4000, 3000, 1920, 1080, 2), { x: 1000, y: 937.5, width: 2000, height: 1125 });
  assert.deepEqual(crop.cameraPhotoCrop(3000, 4000, 1500, 2000, 1), { x: 0, y: 0, width: 3000, height: 4000 });
});
test('a successful sensor still preserves its bytes at full framing and reports real dimensions', async () => {
  class Sensor { getPhotoCapabilities() { return Promise.resolve({ imageWidth: { max: 4000 }, imageHeight: { max: 3000 } }); } takePhoto() { return Promise.resolve(new Blob(['sensor-original'], { type: 'image/webp' })); } }
  await platform(Sensor, async state => {
    const track = { readyState: 'live' }, result = await photo.captureCameraPhoto({ videoWidth: 2000, videoHeight: 1500, version: 7 }, track, 1, () => true);
    assert.equal(result.method, 'still'); assert.equal(result.width, 4000); assert.equal(result.height, 3000); assert.equal(await result.file.text(), 'sensor-original'); assert.match(result.file.name, /\.webp$/); assert.equal(state.released(), 1);
  });
});
test('absent, broken or refused still APIs retain the shutter-time frame and crop', async () => {
  const video = { videoWidth: 2000, videoHeight: 1500, version: 7 };
  for (const constructor of [undefined, class Broken { constructor() { throw new Error('Unavailable'); } }, class Refused { takePhoto() { video.version = 9; return Promise.reject(new Error('Refused')); } }]) {
    video.version = 7;
    await platform(constructor, async () => {
      const result = await photo.captureCameraPhoto(video, { readyState: 'live' }, 2, () => true);
      assert.equal(result.method, 'frame'); assert.equal(result.width, 1000); assert.equal(result.height, 750); assert.equal(await result.file.text(), 'frame-7');
    });
  }
});
test('a closed or replaced track cannot deliver a stale photo', async () => {
  const track = { readyState: 'live' };
  class Closing { takePhoto() { track.readyState = 'ended'; return Promise.resolve(new Blob(['late'], { type: 'image/jpeg' })); } }
  await platform(Closing, async () => assert.rejects(photo.captureCameraPhoto({ videoWidth: 2000, videoHeight: 1500 }, track, 1, source => source.readyState === 'live'), /Camera changed or closed/));
});
test('unresponsive camera operations time out', async () => {
  await assert.rejects(still.cameraDeadline(new Promise(() => undefined), 5), /timed out/);
});
test('native picker remains mounted, releases live camera, and shares the evidence flow', async () => {
  const shared = await readFile('src/components/features/SharedCaptureCamera.tsx', 'utf8'), lifecycle = await readFile('src/hooks/useCameraStream.ts', 'utf8');
  assert.match(shared, /capture="environment"/); assert.match(shared, /deviceCameraInput/); assert.match(shared, /camera.stop\(\); setFileError\(''\); \(native/); assert.match(shared, /if \(!barcode\) \{ onPhoto\?\.\(file\); return; \}/);
  assert.match(lifecycle, /visibilitychange/); assert.match(lifecycle, /pagehide/); assert.match(lifecycle, /request !== generation.current/); assert.match(lifecycle, /releaseCameraStream\(next\)/);
});
