import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const module = { exports: {} };
const source = ts.transpileModule(readFileSync('src/lib/musicRecognitionErrors.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('module', 'exports', source)(module, module.exports);
const { isInvalidMusicJson, musicRecognitionError, recoverMusicIdentification } = module.exports;
const invalid = Object.assign(new Error('OnSpace AI: returned invalid identification JSON.'), { fn: 'swish-identify', status: 422 });

test('recovery is limited to the exact function, HTTP status and parser error', () => {
  assert.equal(isInvalidMusicJson(invalid), true);
  assert.equal(isInvalidMusicJson(new Error(invalid.message)), false);
  assert.equal(isInvalidMusicJson({ ...invalid, message: invalid.message, status: 500 }), false);
  assert.equal(isInvalidMusicJson({ ...invalid, message: invalid.message, fn: 'swish-discogs' }), false);
  assert.equal(isInvalidMusicJson(null), false);
});

test('recognition feedback explains a service failure rather than blaming the photos', () => {
  const message = musicRecognitionError(invalid);
  assert.match(message, /one recovery attempt/);
  assert.match(message, /photos and edits are safe/);
  assert.match(message, /shared identification service/);
  assert.doesNotMatch(message, /retake|bad photo|success/i);
  assert.equal(musicRecognitionError(new Error('Network unavailable')), 'Network unavailable');
});

test('an exhausted recovery budget never issues another AI request', async () => {
  let count = 0;
  const request = async () => { count++; throw invalid; };
  await assert.rejects(recoverMusicIdentification(request, {}, {}, false, new AbortController().signal, () => assert.fail('Unexpected recovery')));
  assert.equal(count, 1);
});

test('cancellation during the recovery notification blocks the second request', async () => {
  const controller = new AbortController();
  let count = 0;
  const request = async () => { count++; throw invalid; };
  await assert.rejects(recoverMusicIdentification(request, {}, {}, true, controller.signal, () => controller.abort()), /cancelled/);
  assert.equal(count, 1);
});
