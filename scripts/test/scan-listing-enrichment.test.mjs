import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const enrichmentSource = (await readFile('src/lib/scanListingEnrichment.ts', 'utf8'))
  .replace(/^import .*;\r?\n/gm, '');
const compiled = ts.transpileModule(enrichmentSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { prefillEbaySpecifics } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);

test('scanner specifics use only evidence and current allowed eBay values', () => {
  const aspects = [
    { name: 'Brand', values: ['Nike', 'adidas'], selectionOnly: true, required: true },
    { name: 'Manufacturer Part Number', values: [], selectionOnly: false, required: true },
    { name: 'Colour', values: ['Black', 'Blue'], selectionOnly: true, required: false },
    { name: 'Material', values: [], selectionOnly: false, required: true },
  ];
  const prepared = prefillEbaySpecifics({ brand: 'Nike', model_number: 'AB-123', colour: 'Green', material: 'unknown' }, aspects);
  assert.deepEqual(prepared.specifics, [
    { name: 'Brand', value: 'Nike' },
    { name: 'Manufacturer Part Number', value: 'AB-123' },
  ]);
  assert.deepEqual(prepared.missingRequired, ['Material']);
});

test('scanner-to-draft route preserves research and review boundaries', async () => {
  const [capture, enrichment, workspace, editor, save] = await Promise.all([
    'src/pages/NicheCapture.tsx', 'src/lib/scanListingEnrichment.ts', 'src/pages/NicheWorkspace.tsx',
    'src/pages/ListingEditor.tsx', 'src/lib/listingEditorSave.ts',
  ].map(path => readFile(path, 'utf8')));
  assert.match(capture, /enrichScannedItemForListing/);
  assert.match(capture, /swish-list-generate/);
  assert.match(capture, /p_category_id: enrichment\.category\?\.id \|\| null/);
  assert.doesNotMatch(capture, /route: 'publish'/);
  assert.match(enrichment, /lookupScopedListingCategory/);
  assert.match(enrichment, /researchScanMarket/);
  const market = await readFile('src/lib/scanMarketResearch.ts', 'utf8');
  assert.match(market, /swish-market-value/);
  assert.match(enrichment, /get_category_aspects/);
  assert.match(market, /applyToItem: true/);
  assert.match(workspace, /`\/studio\/\$\{config\.id\}`/);
  assert.match(editor, /<EbayItemSpecifics/);
  assert.match(save, /form\.item_specifics/);
});
