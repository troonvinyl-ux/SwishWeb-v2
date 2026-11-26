import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const positiveMoney = (...values) => values.map(Number).find(value => Number.isFinite(value) && value > 0) ?? null;
function load(path, dependencies = {}) {
  const module = { exports: {} }, compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
  new Function('require', 'module', 'exports', compiled.outputText)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const fieldDeps = { '@/lib/itemPhotos': { asRecord: record }, '@/lib/itemPricing': { positiveMoney } };
const fields = load('src/lib/scanListingFields.ts', fieldDeps);
const preparation = { category: { id: '12345', name: 'Portable Audio' }, aspects: [], specifics: [{ name: 'Brand', value: 'Fixture' }], missingRequired: ['MPN'], market: { valuation: { fairMarketValue: 24, recommendedListingPrice: 22 } }, marketRefreshed: true, marketError: null, categoryError: null, specificsError: null, conditionError: 'Confirm condition.' };
test('listing prefill uses an explicit backend recommendation, not the market midpoint', () => {
  const generated = { title: 'Fixture audio device', description: 'Seller photos; untested.' };
  const listing = fields.enrichedScanListing(generated, preparation);
  assert.equal(listing.recommended_price, 22); assert.equal(listing.category_id, '12345');
  assert.deepEqual(listing.item_specifics, { Brand: 'Fixture' });
  const noRecommendation = fields.enrichedScanListing(generated, { ...preparation, market: { valuation: { fairMarketValue: 24 } } });
  assert.equal(noRecommendation.recommended_price, undefined);
  assert.match(fields.scanPreparationWarnings(preparation).join(' '), /Confirm.*MPN/);
});
test('seller corrections take precedence over flattened image suggestions', () => {
  const attrs = fields.scanListingAttributes({ brand: 'Guess', attributesInferred: { model: 'A', brand: 'Image suggestion' }, attributes: { colour: 'Black' } }, { brand: 'Seller correction', notes: 'Untested' });
  assert.equal(attrs.brand, 'Seller correction'); assert.equal(attrs.model, 'A'); assert.equal(attrs.notes, 'Untested');
});
function flowHarness(prep = preparation) {
  const calls = [], checkpoint = {}, client = { listing: null, creates: 0 };
  client.rpc = async (name, body) => { assert.equal(name, 'swish_create_listing_draft'); calls.push('draft'); client.creates++; client.category = body.p_category_id; client.listing = { id: 'draft-id', title: body.p_listing.title, description: body.p_listing.description, price: body.p_listing.recommended_price ?? null, status: 'draft', external_listing_id: null, publish_claim_id: null }; return { data: 'draft-id', error: null }; };
  client.from = table => { assert.equal(table, 'listings'); return { select() { return this; }, eq() { return this; }, async single() { return { data: client.listing, error: null }; } }; };
  let current = true;
  const scope = { client, userId: 'seller', tenantId: 'tenant', nicheId: 'tech', sessionId: 'session', isCurrent: () => current };
  const deps = {
    '@/lib/sharedScanPhotos': { prepareScanPhotos: async () => ({ images: ['analysis'], imageLabels: ['Device'], slots: ['device'] }) },
    '@/lib/captureRequest': { captureRecord: record, captureText: value => typeof value === 'string' ? value.trim() : '', captureStrings: value => Array.isArray(value) ? value : [], assertCaptureScope: async value => { if (!value.isCurrent()) throw Error('Workspace changed'); }, captureRequest: async (value, name) => { if (!value.isCurrent()) throw Error('Workspace changed'); calls.push(name); return name === 'swish-identify' ? { identification: { canonicalTitle: 'Fixture audio device', attributesInferred: { brand: 'Fixture' } } } : { listing: { title: 'Fixture audio device', description: 'Untested. Contents shown in photos.' } }; } },
    '@/lib/itemStudio': { prepareSavedCoinPhotos: async (_user, _tenant, _item, photos) => ({ prepared: false, photos, warnings: [] }) },
    '@/lib/capturePersistence': { persistCaptureItem: async () => { calls.push('item'); return 'item-id'; }, persistCapturePhotos: async () => { calls.push('photos'); return ['https://fixture.invalid/original.jpg']; } },
    '@/lib/coinCategoryPolicy': load('src/lib/coinCategoryPolicy.ts'),
    '@/lib/coinCategoryContext': load('src/lib/coinCategoryContext.ts'),
    '@/lib/coinListingGate': {}, '@/lib/numistaCapture': { captureNumistaReference: () => null, parseNumistaNumber: () => null },
    '@/lib/scanListingEnrichment': { enrichScannedItemForListing: async () => { calls.push('research'); return prep; } }, '@/lib/scanListingFields': fields,
  };
  const { prepareQuickCapture } = load('src/lib/quickCaptureFlow.ts', deps);
  const options = { scope, photos: [{ slotId: 'device', label: 'Device', file: {} }], specialistId: 'tech', mode: 'item', answers: { studio_missing_views: 'Model label' }, checkpoint, onCheckpoint: value => Object.assign(checkpoint, value), onProgress() {} };
  return { run: () => prepareQuickCapture(options), calls, client, checkpoint, expire: () => { current = false; } };
}
test('first-photo preparation includes research, canonical draft, price and missing-evidence warnings without publishing', async () => {
  const flow = flowHarness(), draft = await flow.run();
  assert.deepEqual(flow.calls, ['swish-identify', 'item', 'photos', 'research', 'swish-list-generate', 'draft']);
  assert.equal(flow.client.category, '12345'); assert.equal(draft.price, 22); assert.equal(draft.listingId, 'draft-id');
  assert.match(draft.warnings.join(' '), /Incomplete photography: Model label/);
  await flow.run(); assert.equal(flow.client.creates, 1); assert.equal(flow.calls.filter(name => name === 'research').length, 1);
});
test('unavailable research produces an honest partial draft without inventing a selling price', async () => {
  const flow = flowHarness({ ...preparation, category: null, market: null, specifics: [], marketError: 'Market unavailable', categoryError: 'Choose category' });
  const draft = await flow.run(); assert.equal(draft.price, null); assert.equal(flow.client.category, null); assert.match(draft.warnings.join(' '), /Market unavailable/);
});
test('a changed account or tenant cannot continue preparation or issue a draft RPC', async () => {
  const flow = flowHarness(); flow.expire(); await assert.rejects(flow.run(), /Workspace changed/); assert.equal(flow.client.creates, 0);
});
test('bounded market summaries do not retain raw catalogue payloads or invented sale evidence', () => {
  const { scanMarketSnapshot } = load('src/lib/scanMarketResearch.ts', { '@/lib/itemPhotos': { asRecord: record }, '@/lib/supabase': {} });
  const summary = scanMarketSnapshot({ valuation: { fairMarketValue: 20, valuationWarnings: ['Estimate only'], rawCatalogue: 'private' }, soldMarket: { verifiedSoldCount: 0 }, hugePayload: 'x'.repeat(100000) });
  assert.equal(summary.valuation.rawCatalogue, undefined); assert.equal(summary.hugePayload, undefined); assert.equal(summary.soldMarket.medianPrice, undefined);
});
test('specific prefill never truncates evidence or treats a release country as proof of manufacture', () => {
  const source = readFileSync('src/lib/scanListingEnrichment.ts', 'utf8').replace(/^import .*;\r?\n/gm, '');
  const module = { exports: {} }, compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  new Function('module', 'exports', compiled.outputText)(module, module.exports);
  const result = module.exports.prefillEbaySpecifics({ model: 'Model name only', country: 'UK', material: 'x'.repeat(66) }, [{ name: 'Manufacturer Part Number', values: [], selectionOnly: false, required: true }, { name: 'Country of Manufacture', values: [], selectionOnly: false, required: true }, { name: 'Material', values: [], selectionOnly: false, required: true }]);
  assert.deepEqual(result.specifics, []); assert.equal(result.missingRequired.length, 3);
});
test('studio entry points hand off to the complete editor, while specialist and publication safeguards remain', () => {
  const workspace = readFileSync('src/pages/NicheWorkspace.tsx', 'utf8'), quick = readFileSync('src/components/features/QuickCaptureWorkspace.tsx', 'utf8');
  assert.match(workspace, /`\/studio\/\$\{config\.id\}`/); assert.match(quick, /listings\/\$\{flow\.draft\.listingId\}\/edit/);
  assert.match(readFileSync('src/pages/ListingEditor.tsx', 'utf8'), /ListingMarketSummary/);
  assert.match(readFileSync('src/lib/quickCaptureFlow.ts', 'utf8'), /assertCoinDraftReady/);
  assert.match(readFileSync('src/lib/musicPersistence.ts', 'utf8'), /protectMusicListingCopy/);
  assert.doesNotMatch(readFileSync('src/lib/quickCaptureFlow.ts', 'utf8'), /route:\s*['"]publish/);
});
