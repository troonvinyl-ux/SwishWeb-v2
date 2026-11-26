import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const facts = loadRapidTypescript('src/lib/coinListingFacts.ts');
const source = readFileSync('src/lib/scanListingEnrichment.ts', 'utf8').replace(/^import .*;\r?\n/gm, '');
const ts = createRequire(import.meta.url)('typescript');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const module = { exports: {} }; new Function('module', 'exports', compiled.outputText)(module, module.exports);
const aspect = (name, values = []) => ({ name, values, selectionOnly: values.length > 0, required: true });
test('all six identity facts prefill compatible live eBay aspects without inventing grades or certification', () => {
  const attrs = facts.prefillCoinListingFacts({ country: 'Hungary', year: '1673', denomination: '1 denar', ruler: 'Leopold I', composition: 'silver', mint: 'Kremnica' });
  const result = module.exports.prefillEbaySpecifics(attrs, [aspect('Country', ['Hungary']), aspect('Year of Issue'), aspect('Denomination'), aspect('Ruler'), aspect('Composition', ['Silver']), aspect('Mint'), aspect('Grade'), aspect('Certification')]);
  assert.deepEqual(result.specifics, [{ name: 'Country', value: 'Hungary' }, { name: 'Year of Issue', value: '1673' }, { name: 'Denomination', value: '1 denar' }, { name: 'Ruler', value: 'Leopold I' }, { name: 'Composition', value: 'Silver' }, { name: 'Mint', value: 'Kremnica' }]);
  assert.deepEqual(result.missingRequired, ['Grade', 'Certification']);
});
test('metal notation plus a condition annotation stays collector-sourced, not a measurement or certificate', () => {
  const result = facts.prefillCoinListingFacts({ collector_envelope: { transcription: 'Hungary\n1673\nAR. (pierced)', fields: [] } });
  assert.equal(result.composition, 'Silver'); assert.equal(result._coin_listing_prefill.composition.source, 'collector');
  assert.equal(result.grade, undefined); assert.equal(result.metal_tested, undefined);
});
test('a new note reread can replace an old collector projection without replacing actual seller specifics', () => {
  const attrs = { country: 'Russia', _coin_listing_prefill: { country: { value: 'Russia', source: 'collector' } }, collector_envelope: { transcription: 'Hungary\n1673', fields: [] } };
  assert.equal(facts.coinListingFacts(attrs).country.value, 'Hungary');
  const input = loadRapidTypescript('src/lib/coinListingInput.ts');
  assert.equal(input.coinListingInput({ attributes: attrs }, { Country: 'Russia' }).country, 'Russia');
});
