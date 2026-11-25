import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url), ts = require('typescript');
const cache = new Map();
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const transports = {
  '@/lib/captureRequest': {
    assertCaptureScope: async () => {}, captureText: value => typeof value === 'string' ? value.trim() : '', captureRecord: record,
    captureRequest: async (scope, name, body) => { scope.client.generatorCalls.push({ name, body }); return { listing: { title: 'Generated fixture coin' } }; },
  },
  '@/lib/niche': { getSpecialistIdsForNiche: () => ['coins', 'islamic_silver'] },
  '@/lib/sharedScanPhotos': {},
};
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} }; cache.set(path, module.exports);
  const source = readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => transports[name] ?? (name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name)), module, module.exports);
  cache.set(path, module.exports); return module.exports;
}
const { assertCoinDraftReady, canonicalCoinReferenceAnswers, coinDraftReadiness } = load('src/lib/coinListingGate.ts');
const { persistCaptureItem } = load('src/lib/capturePersistence.ts');
const { coinItemDraftReadiness, createCoinListingDraft } = load('src/lib/coinListingPersistence.ts');
const faces = [{ slotId: 'obverse' }, { slotId: 'reverse' }];
const complete = { numista_number: 'N#438449', weight: '28.28', diameter: '38.61' };

test('coin drafts accept both faces without a manually entered Numista number', () => {
  const missing = coinDraftReadiness({ ...complete, numista_number: '' }, faces);
  assert.equal(missing.ready, true);
  assert.equal(missing.typeId, null);
  assert.equal(assertCoinDraftReady({}, faces), null);
  assert.throws(() => assertCoinDraftReady({ ...complete, numista_number: '438449?' }, faces), /Numista N#/);
});

test('coin drafts require both original faces and validate supplied measurements', () => {
  assert.match(coinDraftReadiness(complete, [{ slotId: 'obverse' }]).message, /obverse and reverse/);
  assert.match(coinDraftReadiness({ ...complete, weight: '0' }, faces).message, /weight/);
  assert.equal(coinDraftReadiness({ ...complete, diameter: '' }, faces).ready, true);
  assert.equal(assertCoinDraftReady(complete, faces), 438449);
});

test('a valid Numista input is stored as canonical seller-supplied reference metadata', () => {
  const answers = canonicalCoinReferenceAnswers({ ...complete, numista_number: 'https://en.numista.com/catalogue/pieces438449.html' }, 438449);
  assert.deepEqual({ n: answers.numista_number, id: answers.numista_type_id, source: answers._numista_reference_source }, { n: 'N#438449', id: '438449', source: 'seller_reference' });
  assert.equal(answers.numista_reference, 'https://en.numista.com/catalogue/pieces438449.html');
});

test('a coin cannot continue to shared listing generation if the saved item drops its Numista reference', async () => {
  const answers = canonicalCoinReferenceAnswers(complete, 438449);
  const scope = { nicheId: 'coins', tenantId: 'fixture-tenant', isCurrent: () => true };
  const itemClient = attributes => ({ from: () => ({ insert: payload => ({ select: () => ({ single: async () => ({ data: { id: 'coin-fixture', attributes: attributes ?? payload.attributes }, error: null }) }) }) }) });
  await assert.doesNotReject(() => persistCaptureItem({ ...scope, client: itemClient() }, { canonicalTitle: 'Fixture coin' }, 'coins', answers, 'item'));
  await assert.rejects(() => persistCaptureItem({ ...scope, client: itemClient({ ...answers, numista_type_id: '999999' }) }, { canonicalTitle: 'Fixture coin' }, 'coins', answers, 'item'), /Numista N#438449 was not retained/);
});

function coinItem(overrides = {}) {
  return {
    id: 'coin-fixture', tenant_id: 'fixture-tenant', specialist_id: 'coins', weight_grams: 28.28, dimensions_mm: { diameter: 38.61 },
    attributes: { numista_type_id: '438449', _numista_reference_source: 'seller_reference', source_scan: { scan_metadata: { weight: '28.28', diameter: '38.61' }, scan_images: { obverse: 'https://fixture.invalid/obverse.jpg', reverse: 'https://fixture.invalid/reverse.jpg' } } },
    ...overrides,
  };
}
function coinClient(item) {
  let listing = null;
  const client = { generatorCalls: [], rpcCalls: [] };
  client.from = table => ({
    select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
    single: async () => ({ data: table === 'items' ? item : listing, error: null }),
    maybeSingle: async () => ({ data: listing, error: null }),
  });
  client.rpc = async (name, params) => { client.rpcCalls.push({ name, params }); listing = { id: 'coin-listing', item_id: params.p_item_id, tenant_id: params.p_tenant_id, status: 'draft', external_listing_id: null, publish_claim_id: null }; return { data: listing.id, error: null }; };
  return client;
}

test('coin pull uses the shared generator and canonical draft RPC only after retained Numista evidence passes', async () => {
  const client = coinClient(coinItem());
  const scope = { client, userId: 'fixture-user', tenantId: 'fixture-tenant', nicheId: 'coins', sessionId: 'fixture-session', isCurrent: () => true };
  const draft = await createCoinListingDraft(scope, 'coin-fixture');
  assert.deepEqual(client.generatorCalls.map(call => call.name), ['swish-list-generate']);
  assert.equal(client.rpcCalls[0].name, 'swish_create_listing_draft');
  assert.deepEqual(draft, { listingId: 'coin-listing', reused: false });
  assert.equal((await createCoinListingDraft(scope, 'coin-fixture')).reused, true);
  const missingReference = coinItem({ attributes: { source_scan: coinItem().attributes.source_scan } });
  assert.match(coinItemDraftReadiness(missingReference).message, /Numista N#/);
  const unsafeClient = coinClient(missingReference);
  await assert.rejects(() => createCoinListingDraft({ ...scope, client: unsafeClient }, 'coin-fixture'), /Numista N#/);
  assert.equal(unsafeClient.generatorCalls.length, 0);
});

test('saved original media is accepted as both faces when an older item has no named scan-image map', () => {
  const stored = coinItem({ media: ['https://fixture.invalid/obverse.jpg', 'https://fixture.invalid/reverse.jpg'], attributes: { numista_type_id: '438449', _numista_reference_source: 'seller_reference' } });
  assert.deepEqual(coinItemDraftReadiness(stored), { ready: true, typeId: 438449 });
});

test('coin preparation validates supplied references but allows photo-first identification', () => {
  const flow = readFileSync('src/lib/quickCaptureFlow.ts', 'utf8');
  const persistence = readFileSync('src/lib/capturePersistence.ts', 'utf8');
  const workspace = readFileSync('src/components/features/QuickCaptureWorkspace.tsx', 'utf8');
  assert.match(flow, /assertCoinDraftReady\(answers, photos\)/);
  assert.match(flow, /canonicalCoinReferenceAnswers\(answers, numistaTypeId\)/);
  assert.match(flow, /swish-list-generate/);
  assert.match(flow, /swish_create_listing_draft/);
  assert.match(persistence, /Numista N#\$\{expectedNumistaId\} was not retained/);
  assert.match(workspace, /coinDraftReadiness\(answers, photos\)/);
  assert.match(workspace, /coinReadiness && !coinReadiness\.ready/);
  assert.match(readFileSync('src/lib/coinListingPersistence.ts', 'utf8'), /swish_create_listing_draft/);
  assert.match(readFileSync('src/pages/Identify.tsx', 'utf8'), /Pull eBay draft/);
  const inventory = readFileSync('src/pages/InventoryItem.tsx', 'utf8'), detailWorkspace = readFileSync('src/components/features/ItemDetailWorkspace.tsx', 'utf8');
  assert.match(inventory, /createCoinListingDraft/);
  assert.match(detailWorkspace, /onCreateListingDraft/);
});
