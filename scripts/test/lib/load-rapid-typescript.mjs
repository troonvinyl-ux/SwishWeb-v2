import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), ts = require('typescript');
export function loadRapidTypescript(path, stubs = {}) {
  const result = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
  assert.deepEqual(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [], [], path);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputText)(name => stubs[name] ?? require(name), module, module.exports);
  return module.exports;
}
export const rapidRecord = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const rapidText = value => typeof value === 'string' ? value.trim() : '';
export const rapidStrings = value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
export function rapidFixture(sequence = 1, patch = {}) {
  return { id: `coin-${sequence}`, scope: 'seller:tenant', userId: 'seller', tenantId: 'tenant', batchId: 'batch', sequence, mode: 'envelope', createdAt: sequence, updatedAt: sequence,
    photos: [{ id: 'o', slotId: 'obverse', role: 'coin', name: 'obverse.jpg', type: 'image/jpeg', label: 'Obverse' }, { id: 'r', slotId: 'reverse', role: 'coin', name: 'reverse.jpg', type: 'image/jpeg', label: 'Reverse' }, { id: 'e', slotId: 'envelope', role: 'evidence', name: 'envelope.jpg', type: 'image/jpeg', label: 'Envelope' }],
    answers: {}, enqueued: true, processing: 'captured', publication: 'none', checkpoint: {}, message: '', ...patch };
}
