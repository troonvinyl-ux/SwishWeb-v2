import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('queue shows retained identification and original obverse before a draft exists, without implying Numista is required', () => {
  const source = readFileSync('src/components/features/RapidCoinQueueCard.tsx', 'utf8');
  assert.match(source, /job\.checkpoint\.identification\?\.canonicalTitle/);
  assert.match(source, /job\.checkpoint\.photos\?\.obverse/);
  assert.match(source, /Numista number optional/);
  assert.match(source, /Boolean\(job\.evidence\?\.discrepancies\.length\)/);
  assert.doesNotMatch(source, /No seller-confirmed Numista reference/);
});
test('evidence review offers explicit same-envelope rereading and never promotes handwriting into confirmed facts', () => {
  const evidence = readFileSync('src/components/features/RapidCoinEvidence.tsx', 'utf8');
  const action = readFileSync('src/components/features/CollectorEnvelopeReread.tsx', 'utf8');
  assert.match(evidence, /<CollectorEnvelopeReread job=\{job\}/);
  assert.match(action, /Read envelope again/); assert.match(action, /handwriting stays collector-labelled/);
  assert.match(action, /job\.processing === 'processing'/); assert.match(action, /job\.publication !== 'none'/);
});
test('worker checkpoints a single automatic reread before shared draft preparation and preserves publication safeguards', () => {
  const source = readFileSync('src/lib/rapidCoinPreparation.ts', 'utf8');
  assert.match(source, /!job\.checkpoint\.envelopeReadAttempted/);
  assert.ok(source.indexOf('await keep({ envelopeReadAttempted: true })') < source.indexOf('await readCollectorEnvelope'));
  assert.ok(source.indexOf('await persistCollectorEnvelope') < source.indexOf('const draft = await prepareStableQuickCapture'));
  assert.doesNotMatch(source, /route:\s*['"]publish|chat\/completions/);
});
