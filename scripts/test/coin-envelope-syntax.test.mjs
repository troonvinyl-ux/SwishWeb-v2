import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const FILES = ['src/lib/coinIdentificationRequest.ts', 'src/lib/coinPacketEvidence.ts', 'src/lib/rapidCoinPolicy.ts', 'src/lib/rapidCoinPreparation.ts', 'src/lib/readCollectorEnvelope.ts', 'src/lib/collectorCoinFields.ts', 'src/lib/coinListingFacts.ts', 'src/types/capture.ts', 'src/components/features/RapidCoinQueueCard.tsx'];
for (const path of FILES) test(`coin envelope transport syntax: ${path}`, () => {
  const source = readFileSync(path, 'utf8');
  const result = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
  const errors = (result.diagnostics || []).filter(row => row.category === ts.DiagnosticCategory.Error).map(row => ts.flattenDiagnosticMessageText(row.messageText, '\n'));
  assert.deepEqual(errors, []);
});
