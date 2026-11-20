import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript'), memory = new Map(), module = { exports: {} };
const code = ts.transpileModule(readFileSync('src/lib/scanToLiveTiming.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('module', 'exports', 'sessionStorage', code)(module, module.exports, { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) });
const { beginScanToLive, linkScanToLive, readScanToLive, completeScanToLive, SCAN_TO_LIVE_TARGET_SECONDS } = module.exports;
test('first photo timing follows the same listing and starts are not reset on retries', () => {
  beginScanToLive('user:tenant:session'); const started = readScanToLive('user:tenant:session').startedAt;
  beginScanToLive('user:tenant:session'); linkScanToLive('user:tenant:session', 'user:tenant:listing'); assert.equal(readScanToLive('user:tenant:listing').startedAt, started); assert.equal(SCAN_TO_LIVE_TARGET_SECONDS, 69);
});
test('saved drafts and invalid IDs do not claim live; a confirmed ID records live once', () => {
  assert.equal(readScanToLive('user:tenant:listing').liveAt, undefined); completeScanToLive('user:tenant:listing', 'invalid'); assert.equal(readScanToLive('user:tenant:listing').liveAt, undefined);
  completeScanToLive('user:tenant:listing', '123456789'); const result = readScanToLive('user:tenant:listing'); assert.ok(result.liveAt >= result.startedAt); completeScanToLive('user:tenant:listing', '999999999'); assert.equal(readScanToLive('user:tenant:listing').externalId, '123456789');
});
test('legacy drafts have no fabricated elapsed time', () => { assert.equal(readScanToLive('legacy'), null); completeScanToLive('legacy', '123'); assert.equal(readScanToLive('legacy'), null); });
