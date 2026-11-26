import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
const policy = loadRapidTypescript('src/lib/rapidCoinPolicy.ts', { '@/lib/captureRequest': { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings }, '@/lib/listingPresentation': { listingDescriptionText: String } });
const returned = { transcription: 'Russia / 5 kopeks / 1759?', fields: [{ name: 'date', value: '1759?', source: 'collector', note: 'Question mark retained' }] };
test('empty compatibility envelope object does not hide a returned inferred transcription', () => {
  const result = policy.collectorEvidence({ attributes: { collector_envelope: {} }, attributesInferred: { collector_envelope: returned } });
  assert.equal(result.transcription, returned.transcription); assert.equal(result.fields[0].source, 'collector');
});
test('wrapped identification and response-level envelopes use their returned text, never invented OCR', () => {
  for (const response of [{ result: { identification: { attributes: { collector_envelope: returned } } } }, { identification: { attributes: {} }, collectorEnvelope: returned }]) assert.equal(policy.collectorEvidence(response).transcription, returned.transcription);
  assert.equal(policy.collectorEvidence({}).transcriptionAvailable, false);
});
test('the worker passes the full response and the evidence view can display retained raw transcription', () => {
  assert.match(readFileSync('src/lib/rapidCoinPreparation.ts', 'utf8'), /collectorEvidence\(\{ \.\.\.response, identification: result \}\)/);
  assert.match(readFileSync('src/components/features/RapidCoinEvidence.tsx', 'utf8'), /collectorEvidence\(job\.checkpoint\.identification/);
});
