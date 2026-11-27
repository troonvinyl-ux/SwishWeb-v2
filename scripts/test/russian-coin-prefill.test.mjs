import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadRapidTypescript, rapidRecord, rapidText } from './lib/load-rapid-typescript.mjs';
const facts = loadRapidTypescript('src/lib/coinListingFacts.ts');
const input = loadRapidTypescript('src/lib/coinListingInput.ts');
const lead = loadRapidTypescript('src/lib/collectorEnvelopeLead.ts', { '@/lib/captureRequest': { captureRecord: rapidRecord, captureText: rapidText } });
const context = loadRapidTypescript('src/lib/coinCategoryContext.ts');
const envelope = { transcription: 'Russia\n5 kopeks\n1759\n46.5g\n40mm', transcriptionAvailable: true, fields: [], discrepancies: [] };
test('legible envelope OCR alone populates editable Russian country, year and denomination with collector provenance', () => {
  const result = lead.attachCollectorEvidence({ canonicalTitle: 'Unidentified coin', attributes: {} }, envelope);
  assert.equal(result.attributes.country, 'Russia'); assert.equal(result.attributes.year, '1759'); assert.equal(result.attributes.denomination, '5 kopeks');
  assert.match(result.canonicalTitle, /Russia 5 kopeks 1759/);
  assert.equal(result.attributes._coin_listing_prefill.year.source, 'collector');
  assert.equal(result.attributes.weight_grams, undefined); assert.equal(result.attributes.supplied_weight_g, undefined);
  assert.equal(result.attributes.numista_type_id, undefined); assert.equal(result.attributes.is_lot, undefined);
  const scope = context.coinCategoryContext(result.canonicalTitle, result.attributes);
  assert.equal(scope.country, 'Russia'); assert.equal(scope.year, 1759); assert.equal(scope.lot, false);
});
test('date visible on a coin face is available even if structured envelope fields are absent', () => {
  const result = facts.prefillCoinListingFacts({ observedCharacteristics: { year: 1759 }, collector_envelope: envelope });
  assert.equal(result.year, '1759'); assert.equal(result._coin_listing_prefill.year.source, 'visual');
  assert.equal(result.country, 'Russia'); assert.equal(result.denomination, '5 kopeks');
});
test('seller-edited specifics override both old collector fields and nested AI-confirmed fields', () => {
  const item = { attributes: { collector_envelope: envelope, attributesConfirmed: { country: 'Russia', year: 1759 } } };
  const corrected = input.coinListingInput(item, { 'Country/Region of Origin': 'France', Year: '1760', Denomination: '1 sol' });
  assert.equal(corrected.country, 'France'); assert.equal(corrected.year, '1760'); assert.equal(corrected.denomination, '1 sol');
});
test('ambiguous years and kopeck alone never manufacture a country or a date', () => {
  for (const transcription of ['5 kopeks / 1759?', '5 kopeks / 1759–1762', '5 kopeks / illegible']) {
    const identity = facts.collectorTextIdentity(transcription);
    assert.equal(identity.country, undefined); assert.equal(identity.date, undefined);
  }
  assert.equal(facts.collectorTextIdentity('Russia / 5 kopecks / 1759').denomination, '5 kopeks');
  assert.equal(facts.collectorTextIdentity('Russia / 5 kopeks? / 1759?').denomination, undefined);
});
test('live Russian category aspects receive country, exact year and denomination without grading guesses', () => {
  const source = readFileSync('src/lib/scanListingEnrichment.ts', 'utf8').replace(/^import .*;\r?\n/gm, '');
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const module = { exports: {} }; new Function('module', 'exports', compiled.outputText)(module, module.exports);
  const attrs = facts.prefillCoinListingFacts({ collector_envelope: envelope });
  const aspect = (name, values = []) => ({ name, values, selectionOnly: values.length > 0, required: true });
  const result = module.exports.prefillEbaySpecifics(attrs, [aspect('Country', ['Russia', 'France']), aspect('Year'), aspect('Denomination', ['5 kopeks']), aspect('Grade')]);
  assert.deepEqual(result.specifics, [{ name: 'Country', value: 'Russia' }, { name: 'Year', value: '1759' }, { name: 'Denomination', value: '5 kopeks' }]);
  assert.deepEqual(result.missingRequired, ['Grade']);
});
