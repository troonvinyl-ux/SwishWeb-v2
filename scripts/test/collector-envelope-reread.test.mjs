import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidFixture, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
const capture = { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings };
const policy = loadRapidTypescript('src/lib/rapidCoinPolicy.ts', { '@/lib/captureRequest': capture, '@/lib/listingPresentation': { listingDescriptionText: String } });
const lead = loadRapidTypescript('src/lib/collectorEnvelopeLead.ts', { '@/lib/captureRequest': capture });
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const returned = { transcription: 'Russia / 5 kopeks / 1759? / 46.5g / 40mm', fields: { country: 'Russia', denomination: '5 kopeks', date: { value: '1759?', source: 'collector' }, weight: { value: 46.5, source: 'collector' }, diameter: { value: 40, source: 'collector' } }, discrepancies: [] };
test('dictionary fields, numeric collector measurements and question marks are retained without inventing hard facts', () => {
  const evidence = policy.collectorEvidence({ result: { identification: { attributes: { collector_envelope: returned } } } });
  assert.equal(evidence.transcription, returned.transcription); assert.equal(evidence.fields.find(row => row.name === 'weight').value, '46.5');
  assert.deepEqual(lead.collectorResearchFields(evidence), { country: 'Russia', denomination: '5 kopeks', date: '1759?' });
  const item = lead.attachCollectorEvidence({ canonicalTitle: 'Unidentified coin', attributes: {} }, evidence);
  assert.match(item.canonicalTitle, /Collector-labelled Russia 5 kopeks 1759\?/);
  assert.equal(item.attributes.supplied_weight_g, undefined); assert.equal(item.attributes.numista_type_id, undefined);
  const facts = context.coinCategoryContext(item.canonicalTitle, item.attributes); assert.equal(facts.country, 'Russia'); assert.equal(facts.year, null);
});
test('a useful visual candidate is preserved while the distinct collector lead is retained', () => {
  const evidence = policy.collectorEvidence({ collectorEnvelope: returned });
  const item = lead.attachCollectorEvidence({ canonicalTitle: 'Possible Russian copper coin', attributes: { seller_confirmed_numista: '123' } }, evidence);
  assert.equal(item.canonicalTitle, 'Possible Russian copper coin'); assert.equal(item.attributes.seller_confirmed_numista, '123'); assert.match(item.attributes._collector_research_title, /Russia/);
});
test('targeted reread sends original envelope first and both coin faces to the existing authenticated identify endpoint', async () => {
  const calls = [], job = rapidFixture(1, { checkpoint: { photos: { envelope: 'https://fixture.invalid/envelope.jpg', obverse: 'https://fixture.invalid/obverse.jpg', reverse: 'https://fixture.invalid/reverse.jpg' } } });
  const read = loadRapidTypescript('src/lib/readCollectorEnvelope.ts', { '@/lib/captureRequest': { ...capture, assertCaptureScope: async () => {}, captureRequest: async (_scope, name, body) => { calls.push({ name, body }); return { identification: { canonicalTitle: 'Unidentified coin', attributes: { collector_envelope: returned } } }; } }, '@/lib/rapidCoinPolicy': policy, '@/lib/numistaCapture': { numistaIdentifyKnownAttributes: () => ({}) } });
  const scope = { userId: 'seller', tenantId: 'tenant', nicheId: 'coins' }, result = await read.readCollectorEnvelope(scope, job, 'item');
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'swish-identify');
  assert.deepEqual(calls[0].body.images, [job.checkpoint.photos.envelope, job.checkpoint.photos.obverse, job.checkpoint.photos.reverse]);
  assert.ok(calls[0].body.acquisitionContext.length < 500); assert.match(calls[0].body.knownAttributes.customNotes, /Read every legible line/);
  assert.match(calls[0].body.knownAttributes.customNotes, /coinPacket/); assert.equal(result.evidence.transcriptionAvailable, true);
  await assert.rejects(read.readCollectorEnvelope({ ...scope, userId: 'other' }, job, 'item'), /original seller/); assert.equal(calls.length, 1);
});
test('an empty or generic response is not fabricated into a successful transcription', async () => {
  assert.equal(policy.collectorEvidence({ description: 'Possibly a Russian coin' }).transcriptionAvailable, false);
  const read = loadRapidTypescript('src/lib/readCollectorEnvelope.ts', { '@/lib/captureRequest': { ...capture, assertCaptureScope: async () => {}, captureRequest: async () => ({ identification: { canonicalTitle: 'Unknown coin' } }) }, '@/lib/rapidCoinPolicy': policy, '@/lib/numistaCapture': { numistaIdentifyKnownAttributes: () => ({}) } });
  const job = rapidFixture(1, { checkpoint: { photos: Object.fromEntries(['envelope', 'obverse', 'reverse'].map(slot => [slot, `https://fixture.invalid/${slot}.jpg`])) } });
  await assert.rejects(read.readCollectorEnvelope({ userId: 'seller', tenantId: 'tenant', nicheId: 'coins' }, job, 'item'), /did not return readable/);
});
