import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
async function moduleUrl(path, imports = {}) {
  const output = compile(await readFile(path, 'utf8')).outputText.replace(/(['"])(@\/[^'"]+)\1/g, (match, quote, name) => imports[name] ? JSON.stringify(imports[name]) : match);
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
}
const photosUrl = await moduleUrl('src/lib/itemPhotos.ts');
const fieldsUrl = await moduleUrl('src/lib/identificationFields.ts');
const imports = { '@/lib/itemPhotos': photosUrl, '@/lib/identificationFields': fieldsUrl };
const resultUrl = await moduleUrl('src/lib/identificationResult.ts', imports);
const { normalizeIdentification, identificationCandidates, savedIdentification } = await import(resultUrl);
const { identificationItemPatch } = await import(await moduleUrl('src/lib/identificationItemPatch.ts', { ...imports, '@/lib/identificationResult': resultUrl }));
// Synthetic contract fixture only: not the user's scan, attribution, or inventory data.
const richResult = {
  canonicalTitle: 'Stater — test fixture', confidence: 0.72,
  coinFields: { denomination: 'Stater', issuer: 'Fixture issuer', period: 'Fixture period', mint: 'Fixture mint', composition: 'Silver', obverseDescription: 'Visible obverse design', reverseDescription: 'Visible reverse design', legendFragment: 'Legible fragment', catalogueHint: 'Unverified reference hint' },
  attributesInferred: { country: 'Inferred fixture country', year: 'Date range supplied by fixture' },
  attributesConfirmed: { country: 'Confirmed fixture country' },
  evidenceSupporting: ['Both faces reviewed'], evidenceContradictory: ['Exact variety uncertain'],
  missingInformation: ['Actual weight required'], warnings: ['Attribution needs review'],
};
test('native structured coin fields, confirmed/inferred attributes and observations are retained', () => {
  const candidate = identificationCandidates({ identification: richResult })[0];
  assert.equal(candidate.title, richResult.canonicalTitle);
  assert.equal(candidate.denomination, 'Stater'); assert.equal(candidate.issuer, 'Fixture issuer');
  assert.equal(candidate.mint, 'Fixture mint'); assert.equal(candidate.metal, 'Silver');
  assert.equal(candidate.country, 'Confirmed fixture country');
  assert.equal(candidate.year, 'Date range supplied by fixture');
  assert.match(candidate.description, /Obverse: Visible obverse design/);
  assert.deepEqual(candidate.missingInformation, ['Actual weight required']);
  assert.deepEqual(candidate.contradictions, ['Exact variety uncertain']);
  assert.equal(candidate.coinFields, richResult.coinFields);
});
test('wrapped, direct and legacy responses normalize consistently; explicit failures do not create candidates', () => {
  assert.equal(identificationCandidates({ result: { identification: richResult } })[0].mint, 'Fixture mint');
  assert.equal(identificationCandidates(richResult)[0].title, richResult.canonicalTitle);
  assert.equal(identificationCandidates({ candidates: [{ title: 'Legacy stater', metal: 'Gold' }] })[0].metal, 'Gold');
  assert.equal(identificationCandidates({ candidates: [], identification: richResult }).length, 1);
  for (const failure of [{ success: false, identification: richResult }, { unable_to_identify: true, identification: richResult }, { error: 'Unavailable' }, { result: { unable_to_identify: true, identification: richResult } }, {}]) assert.deepEqual(identificationCandidates(failure), []);
});
test('a title-only stater result does not invent issuer, year, mint or a description', () => {
  const candidate = normalizeIdentification({ title: 'Stater' });
  for (const key of ['issuer', 'year', 'mint', 'description', 'denomination']) assert.equal(candidate[key], undefined);
  assert.equal(normalizeIdentification({ canonicalTitle: 'Stater', country: '', coinFields: { country: 'Fixture country' } }).country, 'Fixture country');
});
test('reviewed details map to canonical columns and preserve measurements, prices, photos and presentation metadata', () => {
  const item = { media: ['https://example.com/original.jpg'], weight_grams: 8.2, diameter_mm: 23, acquired_cost: 10, valuation_mid: 200, expected_selling_price: 210, attributes: { location: 'Tray A', weight_g: 8.2, _smart_studio_images: { saved: true }, source_scan: { scan_metadata: { weight: '8.2' } } } };
  const suggestion = { ...richResult, _itemUpdatedAt: 'version', attributes: { location: 'Replace tray', weight_g: 99, _smart_studio_images: {}, valuation_mid: 0, issuer: 'Fixture issuer' } };
  const patch = identificationItemPatch(item, suggestion, 'reviewed-time');
  assert.equal(patch.canonical_title, richResult.canonicalTitle); assert.equal(patch.denomination, 'Stater');
  assert.equal(patch.mint, 'Fixture mint'); assert.equal(patch.period, 'Fixture period');
  assert.equal(patch.material, 'Silver'); assert.equal(patch.country_of_origin, 'Confirmed fixture country');
  assert.equal(patch.identification_confidence, 0.72);
  for (const key of ['media', 'weight_grams', 'diameter_mm', 'dimensions_mm', 'acquired_cost', 'valuation_mid', 'expected_selling_price', 'status', 'tenant_id', 'specialist_id']) assert.equal(key in patch, false, key);
  assert.equal(patch.attributes.location, 'Tray A'); assert.equal(patch.attributes.weight_g, 8.2);
  assert.deepEqual(patch.attributes._smart_studio_images, { saved: true });
  assert.deepEqual(patch.attributes.source_scan.scan_metadata, { weight: '8.2' });
  assert.equal(patch.attributes.source_scan.confirmed_candidate._itemUpdatedAt, undefined);
  assert.equal(item.valuation_mid, 200); assert.equal(item.weight_grams, 8.2);
});
test('unknown fields do not clear stored information and older saved structured scans remain visible', () => {
  const patch = identificationItemPatch({ country_of_origin: 'Known country', attributes: { country: 'Known country' } }, { title: 'Stater', country: 'Unknown' }, 'time');
  assert.equal('country_of_origin' in patch, false); assert.equal(patch.attributes.country, 'Known country');
  const saved = savedIdentification({ attributes: { source_scan: { confirmed_candidate: richResult } } });
  assert.equal(saved.mint, 'Fixture mint'); assert.equal(saved.reference, 'Unverified reference hint');
  const legacy = savedIdentification({ canonical_title: 'Reviewed stater', attributes: { canonicalTitle: 'Old title', source_scan: { confirmed_candidate: { title: 'Reviewed stater' } } } });
  assert.equal(legacy.title, 'Reviewed stater'); assert.equal(normalizeIdentification(legacy).title, 'Reviewed stater');
});
test('Re-ID retains version and tenant guards, uses original photos, and has no eBay mutation', async () => {
  const hook = await readFile('src/hooks/useItemIntelligence.ts', 'utf8');
  assert.match(hook, /identificationItemPatch\(item, candidate/);
  assert.match(hook, /eq\('updated_at', candidate\._itemUpdatedAt\)/);
  assert.match(hook, /eq\('tenant_id', tenantId\)/); assert.match(hook, /photo\.original/);
  assert.doesNotMatch(hook, /swish-ebay-list|from\('listings'\)\.update/);
  assert.doesNotMatch(await readFile('src/pages/InventoryItem.tsx', 'utf8'), /applyIdentificationTitle|Apply suggested title/);
});
test('changed source files have no TypeScript syntax diagnostics', async () => {
  const paths = ['src/lib/identificationFields.ts', 'src/lib/identificationResult.ts', 'src/lib/identificationItemPatch.ts', 'src/components/features/IdentificationDetails.tsx', 'src/components/features/ItemOverview.tsx', 'src/components/features/ItemReidentifyReview.tsx', 'src/hooks/useItemIntelligence.ts', 'src/pages/Identify.tsx', 'src/pages/InventoryItem.tsx'];
  for (const path of paths) assert.equal(compile(await readFile(path, 'utf8')).diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length ?? 0, 0, path);
});
