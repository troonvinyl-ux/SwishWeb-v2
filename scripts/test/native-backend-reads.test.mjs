import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript'), cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const mod = { exports: {} }, result = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
  assert.deepEqual(result.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error) || [], []);
  new Function('require', 'module', 'exports', result.outputText)(name => load(`src/${name.slice(2)}.ts`), mod, mod.exports);
  cache.set(path, mod.exports); return mod.exports;
}
const { backendRead } = load('src/lib/backendRequests.ts');
const { queueBackendRead } = load('src/lib/backendReadQueue.ts');
const client = () => { let token = 'session-a'; return { auth: { getSession: async () => ({ data: { session: { access_token: token } }, error: null }) }, change: () => { token = 'session-b'; } }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release: () => release({ data: true, error: null }) }; };
test('same-session duplicate reads share pending work but not cached authorization', async () => {
  const sb = client(), wait = gate(); let calls = 0;
  const operation = () => { calls++; return wait.promise; };
  const one = backendRead(sb, 'same', operation), two = backendRead(sb, 'same', operation);
  await tick(); assert.equal(calls, 1); wait.release(); await Promise.all([one, two]);
  await backendRead(sb, 'same', operation); assert.equal(calls, 2);
});
test('two running reads bound concurrency and access reads take priority over background work', async () => {
  const first = gate(), second = gate(), events = [];
  const a = queueBackendRead(() => first.promise, 'foreground', 1000), b = queueBackendRead(() => second.promise, 'foreground', 1000);
  const background = queueBackendRead(() => { events.push('background'); return Promise.resolve(true); }, 'background', 1000);
  const access = queueBackendRead(() => { events.push('access'); return Promise.resolve(true); }, 'access', 1000);
  await tick(); assert.deepEqual(events, []); first.release(); second.release(); await Promise.all([a, b, background, access]);
  assert.deepEqual(events, ['access', 'background']);
});
test('session replacement rejects queued dispatch and in-flight results', async () => {
  const sb = client(), a = gate(), b = gate(); let queuedCalls = 0;
  const first = backendRead(sb, 'a', () => a.promise), second = backendRead(sb, 'b', () => b.promise);
  const third = backendRead(sb, 'queued', () => { queuedCalls++; return Promise.resolve(true); });
  const result = Promise.allSettled([first, second, third]); await tick(); sb.change(); a.release(); b.release();
  assert.ok((await result).every(row => row.status === 'rejected')); assert.equal(queuedCalls, 0);
});
test('read timeout is bounded and temporarily suppresses duplicate retries without replay', async () => {
  const sb = client(), wait = gate(); let calls = 0;
  const operation = () => { calls++; return wait.promise; };
  await assert.rejects(backendRead(sb, 'slow', operation, 'foreground', 10), /timed out/);
  await assert.rejects(backendRead(sb, 'slow', operation), /timed out/); assert.equal(calls, 1); wait.release(); await tick();
});
test('authentication denial is not treated as temporary backend availability', async () => {
  const sb = client(); let calls = 0;
  const operation = () => { calls++; return Promise.resolve({ status: 403, error: { message: 'access denied' } }); };
  await assert.rejects(backendRead(sb, 'denied', operation), /403/); await assert.rejects(backendRead(sb, 'denied', operation), /403/);
  assert.equal(calls, 2);
});
