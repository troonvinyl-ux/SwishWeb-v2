import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
const capture = { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings };
const request = loadRapidTypescript('src/lib/coinIdentificationRequest.ts', { '@/lib/captureRequest': capture });
const policy = loadRapidTypescript('src/lib/rapidCoinPolicy.ts', { '@/lib/captureRequest': capture, '@/lib/listingPresentation': { listingDescriptionText: String } });
const packet = { transcript: 'Hungary\n1673\nLeopold I\n3 Kreuzers\nAR.\n2.5 g', fields: { year: { value: '1673', quote: '1673', uncertain: false }, ruler: { value: 'Leopold I', quote: 'Leopold I', uncertain: false }, denomination: { value: '3 Kreuzers', quote: '3 Kreuzers', uncertain: false }, weight_g: { value: '2.5', quote: '2.5 g', uncertain: false } }, limitations: [] };
test('both acquisition contexts are short; full coin instructions and seller notes remain in knownAttributes', () => {
  for (const context of [request.COIN_ACQUISITION_CONTEXT, request.ENVELOPE_ACQUISITION_CONTEXT]) {
    const body = { acquisitionContext: context, knownAttributes: { customNotes: `${policy.RAPID_COIN_INSTRUCTIONS}\nSeller notes: Hungary 1673` }, imageLabels: ['Original envelope'] };
    assert.equal(request.coinIdentificationRequest(body), body); assert.ok(context.length < 500);
    assert.match(body.knownAttributes.customNotes, /Hungary 1673/);
  }
  assert.throws(() => request.coinIdentificationRequest({ acquisitionContext: policy.RAPID_COIN_INSTRUCTIONS }), /short workflow label/);
});
test('oversized seller notes are rejected locally without truncating the original evidence', () => {
  const notes = '字'.repeat(11000), body = { acquisitionContext: request.COIN_ACQUISITION_CONTEXT, knownAttributes: { customNotes: notes } };
  assert.throws(() => request.coinIdentificationRequest(body), /30 KB/); assert.equal(body.knownAttributes.customNotes, notes);
});
test('native top-level and persisted SWISH packet formats are read despite empty legacy envelopes', () => {
  for (const response of [{ coinPacket: packet }, { identification: { coinPacket: packet } }, { result: { identification: { attributes: { _coin_packet: packet, collector_envelope: {} } } } }, { attributes: { _coin_packet: packet } }]) {
    const evidence = policy.collectorEvidence(response); assert.equal(evidence.transcription, packet.transcript);
    assert.equal(evidence.transcriptionAvailable, true); assert.equal(evidence.fields.find(row => row.name === 'date').value, '1673');
    assert.ok(evidence.fields.every(row => row.source === 'collector')); assert.equal(evidence.fields.find(row => row.name === 'weight').value, '2.5');
  }
});
test('native packet quote and measurement-unit guards reject unsupported expansions and preserve uncertainty', () => {
  const evidence = policy.collectorEvidence({ coinPacket: { ...packet, fields: { ruler: { value: 'Leopold Ignatius', quote: 'Leopold I', uncertain: false }, year: { value: '1673', quote: '1673', uncertain: true }, mint: { value: 'Vienna', quote: 'Vienna', uncertain: false }, weight_g: { value: '2.5', quote: '3 Kreuzers', uncertain: false } } } });
  assert.deepEqual(evidence.fields.map(row => row.name), ['date']); assert.match(evidence.fields[0].value, /\?/);
  const fields = loadRapidTypescript('src/lib/collectorCoinFields.ts').collectorCoinFields({ _coin_packet: { ...packet, fields: { year: { value: '1673', quote: '1673', uncertain: true } } } });
  assert.equal(fields.year, ''); assert.match(fields.date, /\?/);
});
test('packet readings populate all literal note fields without becoming seller measurements or authentication', () => {
  const facts = loadRapidTypescript('src/lib/coinListingFacts.ts'), attribution = loadRapidTypescript('src/lib/coinAttribution.ts');
  const attrs = { _coin_packet: packet, year: '1673', _packet_year: true };
  const fields = facts.coinListingFacts(attrs);
  assert.equal(fields.country.value, 'Hungary'); assert.equal(fields.year.source, 'collector');
  assert.equal(fields.ruler.value, 'Leopold I'); assert.equal(fields.denomination.value, '3 Kreuzers');
  assert.equal(fields.composition.value, 'Silver'); assert.equal(fields.mint, undefined);
  assert.equal(attribution.coinAttribution(attrs).status, 'provisional'); assert.equal(attrs.supplied_weight_g, undefined);
});
