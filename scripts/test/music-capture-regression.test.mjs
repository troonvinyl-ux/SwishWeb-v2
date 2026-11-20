import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

// Isolated contract fixtures. No live AI, Discogs, storage or selling requests.
function harness(observedFormat = 'Vinyl', respond = () => null) {
  const calls = [];
  const cache = new Map();
  const mocks = {
    '@/lib/supabase': {
      callEdgeFunction: async (name, body) => {
        calls.push({ name, body });
        if (!['item', 'cd_box_set'].includes(body.captureMode)) {
          return { data: null, error: { displayMessage: 'Capture mode is not supported' } };
        }
        const response = await respond(body, calls.length, name);
        if (response) return response;
        return { data: { identification: { attributesConfirmed: {
          artist: 'Fixture Artist', release_title: 'Fixture Album', format: observedFormat,
        } } }, error: null };
      },
    },
    '@/lib/captureRequest': {
      assertCaptureScope: async scope => { if (!scope.isCurrent()) throw new Error('Workspace changed'); },
      captureRecord: record,
      captureText: value => typeof value === 'string' ? value.trim() : '',
      captureStrings: value => Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : [],
    },
    '@/lib/sharedScanPhotos': {
      prepareScanPhotos: async photos => ({
        images: photos.map(() => 'data:image/jpeg;base64,AAAA'),
        imageLabels: photos.map(photo => photo.label),
        slots: photos.map(photo => photo.slotId),
      }),
    },
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    cache.set(path, module.exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => mocks[name] ?? (
      name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name)
    ), module, module.exports);
    cache.set(path, module.exports);
    return module.exports;
  }
  return { calls, api: load('src/lib/musicApi.ts'), mode: load('src/lib/musicCaptureMode.ts').musicCaptureMode };
}

const scope = { tenantId: 'fixture-tenant', userId: 'fixture-user', nicheId: 'tunes_flip', client: {}, isCurrent: () => true };
const photos = count => Array.from({ length: count }, (_, index) => ({
  slotId: `view_${index}`, label: `Evidence view ${index}`, file: {},
}));
const fields = format => ({ format: { value: format, source: 'user', confidence: null } });

for (const [format, expected] of [['Vinyl LP', 'item'], ['Cassette', 'item'], ['CD', 'cd_box_set'], ['Multi-disc CD compilation', 'cd_box_set'], ['Box set', 'cd_box_set'], ['Record', 'item']]) {
  test(`${format} sends a supported SWISH capture mode and preserves music scope`, async () => {
    const { api, calls } = harness(format);
    const result = await api.identifyMusicPhotos(scope, photos(1), fields(format), new AbortController().signal);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'swish-identify');
    assert.equal(calls[0].body.captureMode, expected);
    assert.equal(calls[0].body.specialistId, 'vinyl_records');
    assert.equal(calls[0].body.tenantId, scope.tenantId);
    assert.equal(calls[0].body.nicheId, 'tunes_flip');
    assert.equal(result.fields.artist.value, 'Fixture Artist');
  });
}

test('unknown format defaults to item; later batches use the recognised format', async () => {
  const { api, calls, mode } = harness('CD');
  assert.equal(mode({}), 'item');
  await api.identifyMusicPhotos(scope, photos(12), {}, new AbortController().signal);
  assert.deepEqual(calls.map(call => call.body.captureMode), ['item', 'cd_box_set']);
  assert.deepEqual(calls.map(call => call.body.images.length), [8, 4]);
  assert.equal(calls[1].body.knownAttributes.existingAttributes.artist, 'Fixture Artist');
});

test('cancelled recognition never invokes the backend', async () => {
  const { api, calls } = harness();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.identifyMusicPhotos(scope, photos(1), {}, controller.signal), /cancelled/);
  assert.equal(calls.length, 0);
});

test('mobile music grid and wrapped error spans do not depend on clipping content', () => {
  const page = readFileSync('src/pages/TunesCapture.tsx', 'utf8');
  const css = readFileSync('src/components/features/musicWorkspace.css', 'utf8');
  assert.match(page, /grid min-w-0 grid-cols-1/);
  assert.match(page, /<span className="min-w-0 break-words">\{research\.error\}/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /:where\(\.grid,\.music-price-grid\)>\* \{ min-width:0;/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /overflow-x:\s*hidden/);
});

// Error fixtures mirror the structured EdgeFunctionError; no production AI is called.
const failure = (status = 422, message = 'OnSpace AI: returned invalid identification JSON.', fn = 'swish-identify') => ({
  data: null, error: Object.assign(new Error(message), { fn, status }),
});

test('invalid AI JSON gets one compact-schema recovery with the same evidence and scope', async () => {
  const { api, calls } = harness('Vinyl', (_body, count) => count === 1 ? failure() : null);
  const input = photos(2), progress = [];
  const result = await api.identifyMusicPhotos(scope, input, fields('Vinyl'), new AbortController().signal,
    (partial, message) => progress.push({ partial, message }));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].body.images, calls[0].body.images);
  assert.deepEqual(calls[1].body.imageLabels, calls[0].body.imageLabels);
  assert.equal(calls[1].body.tenantId, scope.tenantId);
  assert.equal(calls[1].body.nicheId, 'tunes_flip');
  assert.match(calls[1].body.knownAttributes.customNotes, /previous response was rejected as invalid JSON/);
  assert.match(calls[1].body.knownAttributes.customNotes, /server identification JSON schema/);
  assert.equal(progress[0].partial, null);
  assert.match(progress[0].message, /Retrying once/);
  assert.equal(result.fields.artist.value, 'Fixture Artist');
  assert.equal(input.length, 2);
});

test('a second malformed response stops without inventing details or mutating inputs', async () => {
  const { api, calls } = harness('Vinyl', () => failure());
  const input = photos(2), known = fields('Cassette'), before = JSON.stringify({ input, known });
  const progress = [];
  await assert.rejects(api.identifyMusicPhotos(scope, input, known, new AbortController().signal,
    partial => progress.push(partial)), /invalid identification JSON/);
  assert.equal(calls.length, 2);
  assert.deepEqual(progress, [null]);
  assert.equal(JSON.stringify({ input, known }), before);
});

for (const [status, message, fn] of [
  [401, 'Sign in again', 'swish-identify'], [403, 'Module not entitled', 'swish-identify'],
  [429, 'Quota exceeded', 'swish-identify'], [422, 'Invalid photo labels', 'swish-identify'],
  [500, 'Provider unavailable', 'swish-identify'], [0, 'Network disconnected', 'swish-identify'],
  [422, 'OnSpace AI: returned invalid identification JSON.', 'swish-discogs'],
]) {
  test(`${fn} ${status} ${message} is never automatically replayed`, async () => {
    const { api, calls } = harness('Vinyl', () => failure(status, message, fn));
    await assert.rejects(api.identifyMusicPhotos(scope, photos(1), {}, new AbortController().signal));
    assert.equal(calls.length, 1);
  });
}

test('cancellation after a malformed response prevents recovery', async () => {
  const controller = new AbortController();
  const { api, calls } = harness('Vinyl', () => { controller.abort(); return failure(); });
  await assert.rejects(api.identifyMusicPhotos(scope, photos(1), {}, controller.signal));
  assert.equal(calls.length, 1);
});

test('workspace changes prevent recovery from reaching another account', async () => {
  let active = true;
  const { api, calls } = harness('Vinyl', () => { active = false; return failure(); });
  await assert.rejects(api.identifyMusicPhotos({ ...scope, isCurrent: () => active }, photos(1), {}, new AbortController().signal), /Workspace changed/);
  assert.equal(calls.length, 1);
});

test('successful batches are delivered before later batch failure', async () => {
  const { api, calls } = harness('Vinyl', (_body, count) => count > 1 ? failure() : null);
  const progress = [];
  await assert.rejects(api.identifyMusicPhotos(scope, photos(12), {}, new AbortController().signal,
    partial => { if (partial) progress.push(partial); }));
  assert.equal(calls.length, 3);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].fields.artist.value, 'Fixture Artist');
});

test('one recovery budget covers the whole twelve-photo recognition, not each batch', async () => {
  const { api, calls } = harness('CD', (_body, count) => count === 2 ? null : failure());
  await assert.rejects(api.identifyMusicPhotos(scope, photos(12), {}, new AbortController().signal));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.body.images.length), [8, 8, 4]);
});

test('native matrix/condition names are used and grading/location are not photo instructions', async () => {
  const known = { ...fields('CD'), matrix_runout: { value: 'ABC-123 A1', source: 'user' },
    condition_notes: { value: 'Split seam', source: 'user' }, location: { value: 'Shelf A', source: 'user' },
    media_grade: { value: 'NM', source: 'user' } };
  const { api, calls } = harness('CD');
  await api.identifyMusicPhotos(scope, photos(1), known, new AbortController().signal);
  const attrs = calls[0].body.knownAttributes.existingAttributes;
  assert.equal(attrs.matrix, 'ABC-123 A1');
  assert.equal(attrs.damage_notes, 'Split seam');
  assert.equal(attrs.matrix_runout, undefined);
  assert.equal(attrs.location, undefined);
  assert.equal(attrs.media_grade, undefined);
});

test('native scalar damage notes populate the editable condition field', async () => {
  const { api } = harness('Vinyl', () => ({ data: { identification: { attributesConfirmed: {
    artist: 'Fixture Artist', release_title: 'Fixture Album', matrix: 'ABC-123 A1', damage_notes: 'Split seam',
  } } }, error: null }));
  const result = await api.identifyMusicPhotos(scope, photos(1), {}, new AbortController().signal);
  assert.equal(result.fields.condition_notes.value, 'Split seam');
  assert.equal(result.fields.matrix_runout.value, 'ABC-123 A1');
});

test('failed recognition shows a paused state and retry clears prior feedback', () => {
  const source = readFileSync('src/hooks/useMusicResearch.ts', 'utf8');
  assert.match(source, /Recognition paused\. Your photos and edits are retained/);
  assert.match(source, /setError\(''\);setWarnings\(\[\]\);setTiming\(null\)/);
  assert.match(source, /Photo details recognised\. The Discogs check could not finish/);
  assert.match(source, /source\.applyFields\(partial\.fields\)/);
  assert.match(readFileSync('src/components/layout/Header.tsx', 'utf8'), /'\/scan\/tunes_flip': 'Tunes Flip · Identify Music'/);
});
