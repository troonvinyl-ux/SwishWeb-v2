import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidRecord, rapidText } from './lib/load-rapid-typescript.mjs';
const facts = loadRapidTypescript('src/lib/coinListingFacts.ts');
const attribution = loadRapidTypescript('src/lib/coinAttribution.ts');
const copy = loadRapidTypescript('src/lib/coinAttributionCopy.ts');
const lead = loadRapidTypescript('src/lib/collectorEnvelopeLead.ts', { '@/lib/captureRequest': { captureRecord: rapidRecord, captureText: rapidText } });
const input = loadRapidTypescript('src/lib/coinListingInput.ts');
const selection = loadRapidTypescript('src/lib/listingCategorySelection.ts');
const envelope = { transcription: 'Hungary\n1673\nLeopold Ignatius\n1656–1705\nAR', fields: [], discrepancies: [], transcriptionAvailable: true };
test('reported note carries Hungary, standalone 1673, literal ruler and AR notation without treating the reign as the issue year', () => {
  const result = lead.attachCollectorEvidence({ canonicalTitle: 'Unidentified coin', attributes: { observedCharacteristics: { year: '1673' } } }, envelope);
  assert.equal(result.attributes.country, 'Hungary'); assert.equal(result.attributes.year, '1673'); assert.equal(result.attributes.ruler, 'Leopold Ignatius'); assert.equal(result.attributes.composition, 'Silver');
  assert.equal(result.attributes._coin_listing_prefill.year.source, 'visual'); assert.equal(result.attributes._coin_listing_prefill.composition.source, 'collector');
  assert.equal(result.attributes.denomination, undefined); assert.equal(result.attributes.mint, undefined); assert.equal(result.attributes.authenticity, undefined);
});
test('all six structured note fields produce editable facts while an uncertain attribution remains provisional', () => {
  const attributes = { collector_envelope: { ...envelope, fields: ['country', 'date', 'denomination', 'ruler', 'composition', 'mint'].map((name, i) => ({ name, value: ['Hungary', '1673', '1 denar', 'Leopold I', 'Silver', 'Kremnica'][i], source: 'collector' })) } };
  const result = facts.coinListingFacts(attributes);
  assert.equal(Object.keys(result).length, 6); assert.equal(attribution.coinAttribution(attributes).status, 'provisional');
  assert.equal(result.mint.source, 'collector');
});
test('matching literal observations and the note can corroborate attribution, but a conflict retains provisional wording', () => {
  const attrs = { country: 'Hungary', year: '1673', denomination: '1 denar', observedCharacteristics: { country: 'Hungary', year: '1673', denomination: '1 denar' }, collector_envelope: { transcription: 'Hungary\n1673\n1 denar', fields: [], discrepancies: [] } };
  assert.equal(attribution.coinAttribution(attrs).status, 'corroborated');
  const contradicted = attribution.coinAttribution({ ...attrs, observedCharacteristics: { ...attrs.observedCharacteristics, year: '1674' } });
  assert.equal(contradicted.status, 'provisional'); assert.ok(contradicted.conflicts.some(line => /1674.*1673/.test(line)));
  assert.equal(attribution.coinAttribution({ ...attrs, observedCharacteristics: {} }).status, 'provisional');
});
test('seller specifics override all six AI proposals and survive a category change', () => {
  const specifics = { Country: 'Austria', Year: '1674', Denomination: '2 kreuzer', Ruler: 'Leopold I', Composition: 'Silver', Mint: 'Vienna', Artist: 'Wrong branch' };
  const attrs = input.coinListingInput({ attributes: { observedCharacteristics: { country: 'Hungary', year: '1673' }, collector_envelope: envelope } }, specifics);
  assert.equal(attrs.country, 'Austria'); assert.equal(attrs.year, '1674'); assert.equal(attrs.mint, 'Vienna');
  const retained = selection.retainedCoinIdentitySpecifics(specifics); assert.equal(Object.keys(retained).length, 6); assert.equal(retained.Artist, undefined);
});
test('provisional copy retains condition, item specifics and all known facts; assembly is idempotent and never invents a denomination', () => {
  const attrs = { collector_envelope: envelope, observedCharacteristics: { year: '1673' } };
  const generated = { title: 'Unidentified coin', description: 'Visible wear and a piercing. Sold as photographed.', item_specifics: {}, recommended_price: 30 };
  const result = copy.assembleCoinAttributionCopy(generated, attrs);
  assert.match(result.title, /Attributed to.*Hungary.*1673/); assert.ok(result.title.length <= 80);
  assert.match(result.description, /Previously attributed as/); assert.match(result.description, /Visible wear and a piercing/); assert.match(result.description, /Composition: Silver \(collector-recorded/);
  assert.equal(result.description.includes('Denomination:'), false); assert.deepEqual(result.item_specifics, {}); assert.equal(result.recommended_price, 30);
  assert.deepEqual(copy.assembleCoinAttributionCopy(result, attrs), result);
});
