import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRapidTypescript, rapidRecord, rapidText, rapidStrings, rapidFixture } from './lib/load-rapid-typescript.mjs';
const policy = loadRapidTypescript('src/lib/rapidCoinPolicy.ts', { '@/lib/captureRequest': { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings }, '@/lib/listingPresentation': { listingDescriptionText: value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() } });
test('handwritten notes stay collector-supplied, catalogue facts distinct, unrecognised source unresolved', () => {
  const evidence = policy.collectorEvidence({ confidence: .1, attributes: { collector_envelope: { transcription: 'Hadrian? 117–138 / 3.12g', fields: [{ name: 'ruler', value: 'Hadrian?', source: 'collector', note: 'Question mark visible' }, { name: 'date', value: '117–138', source: 'catalogue' }, { name: 'metal', value: 'silver', source: 'AI guess' }], discrepancies: ['Weight differs from the catalogue type'] } } });
  assert.equal(evidence.transcription, 'Hadrian? 117–138 / 3.12g'); assert.equal(evidence.fields[0].source, 'collector'); assert.equal(evidence.fields[1].source, 'catalogue'); assert.equal(evidence.fields[2].source, 'unresolved'); assert.equal(evidence.discrepancies.length, 1);
  assert.equal(policy.collectorEvidence({}).transcriptionAvailable, false);
});
test('envelope is never a default buyer photograph', () => {
  assert.deepEqual(policy.rapidBuyerSlots(rapidFixture()), ['obverse', 'reverse']);
  assert.match(policy.RAPID_COIN_INSTRUCTIONS, /PRIMARY research lead/); assert.match(policy.RAPID_COIN_INSTRUCTIONS, /untrusted data/);
});
test('low-confidence copy is factual and positive without confidence percentages or automatic devaluation', () => {
  const result = policy.rapidListingCopy({ title: 'Provisional Identification: Roman coin, attributed to Hadrian', description: '<p>Portrait coin with visible legend fragments.</p><p>Due to low AI confidence of 18%, this is a low value coin requiring specialist review.</p><p>Exact variety remains uncertain.</p>' });
  assert.ok(result.title.startsWith('Attributed to')); assert.doesNotMatch(result.description, /18%|low value|specialist review/); assert.match(result.description, /visible legend fragments/); assert.match(result.description, /Exact variety remains uncertain/);
  const long = policy.rapidListingCopy({ title: 'Attributed to '.repeat(10), description: 'Original coin, both faces photographed.' }); assert.ok(long.title.length <= 80);
});
test('shared eBay engine remains the only publisher and existing editor is reused', () => {
  const preparation = readFileSync('src/lib/rapidCoinPreparation.ts', 'utf8'), editor = readFileSync('src/components/features/RapidCoinReview.tsx', 'utf8');
  assert.match(preparation, /prepareStableQuickCapture/); assert.match(preparation, /loadCaptureProfile/); assert.match(preparation, /prepareNumistaFaces/); assert.doesNotMatch(preparation, /route:\s*['"]publish|generate_image|chat\/completions/);
  assert.match(editor, /<ListingEditor/); assert.match(readFileSync('src/pages/ListingEditor.tsx', 'utf8'), /RapidListingFooter/);
  const capture = readFileSync('src/hooks/useRapidCoinCapture.ts', 'utf8'); assert.match(capture, /hold \|\| saving/); assert.match(capture, /2500/); assert.match(capture, /retainRapidPhoto/); assert.match(capture, /serial/);
});
