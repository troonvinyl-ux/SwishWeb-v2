import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidFixture, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
function harness({ reference = '', unavailable = false } = {}) {
  let job = rapidFixture(1, { answers: { numista_number: reference, notes: 'Collector ticket supplied' }, processing: 'processing', lease: { owner: 'worker', until: Date.now() + 180000 } }), inserts = 0, calls = [];
  let item = null;
  const photos = job.photos.map(photo => ({ ...photo, file: {}, preview: '' }));
  const client = { from: table => {
    assert.equal(table, 'items'); let patch;
    const q = { select: () => q, eq: () => q, update: value => { patch = value; return q; }, single: async () => ({ data: item, error: null }), maybeSingle: async () => { if (patch) item = { ...item, ...patch }; return { data: item, error: null }; } }; return q;
  } };
  const capture = { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings, assertCaptureScope: async scope => { if (!scope.isCurrent()) throw Error('Scope changed'); }, captureRequest: async (scope, name, body) => {
    calls.push({ name, body }); return { identification: { canonicalTitle: 'Attributed Roman portrait coin', specialistId: 'coins', objectType: 'coin', confidence: .1, condition: 'Used', attributes: { collector_envelope: { transcription: 'Roman / Hadrian? / silver?', fields: [{ name: 'ruler', value: 'Hadrian?', source: 'collector', note: 'Question mark' }], discrepancies: ['Mint mark not visible'] }, photo_roles: [{ slotId: 'envelope', role: 'coin' }] } } };
  } };
  const policy = loadRapidTypescript('src/lib/rapidCoinPolicy.ts', { '@/lib/captureRequest': capture, '@/lib/listingPresentation': { listingDescriptionText: String } });
  const numista = loadRapidTypescript('src/lib/numistaCapture.ts');
  const stubs = {
    '@/lib/captureRequest': capture, '@/lib/sharedScanPhotos': { prepareScanPhotos: async photos => ({ images: photos.map(() => 'data:image/jpeg;base64,YQ=='), slots: photos.map(p => p.slotId), imageLabels: photos.map(p => p.label) }) },
    '@/lib/nativeCaptureProfiles': { loadCaptureProfile: async () => { if (unavailable) throw Error('Profile unavailable'); return { modes: [{ id: 'item' }] }; } },
    '@/lib/numistaCapture': { ...numista, prepareNumistaFaces: async () => [{ label: 'Obverse', image_data: 'YQ==' }, { label: 'Reverse', image_data: 'YQ==' }] },
    '@/lib/coinListingGate': { assertCoinDraftReady: answers => numista.parseNumistaNumber(answers.numista_number), canonicalCoinReferenceAnswers: (answers, id) => ({ ...answers, numista_type_id: String(id) }) },
    '@/lib/rapidCoinPhotos': { loadRapidPhotos: async () => photos, uploadRapidOriginals: async (scope, current, original, keep) => { const urls = Object.fromEntries(original.map(p => [p.slotId, `https://fixture.invalid/${p.slotId}.jpg`])); await keep(urls); return urls; } },
    '@/lib/rapidCoinDatabase': { changeRapidJob: async (id, scope, update) => { assert.equal(id, job.id); assert.equal(scope, job.scope); job = update(job); return job; } },
    '@/lib/capturePersistence': { persistCaptureItem: async (scope, result, specialist, answers, mode, id) => { assert.equal(id, job.id); assert.equal(mode, 'item'); inserts++; item = { id, tenant_id: 'tenant', attributes: result.attributes, media: [], updated_at: 'version' }; return id; } },
    '@/lib/listingStudioPreparation': { prepareStableQuickCapture: async options => { calls.push({ name: 'shared-draft', body: options }); assert.equal(options.stableItemId, job.id); await options.onCheckpoint({ ...job.checkpoint, listingId: 'listing' }); item.media = Object.values(job.checkpoint.photos); return { itemId: job.id, listingId: 'listing', title: 'Attributed Roman portrait coin', description: 'Original coin shown.', price: 45, photos: options.buyerSlots.map(slot => job.checkpoint.photos[slot]), warnings: [] }; } },
    '@/lib/rapidCoinPolicy': policy, '@/lib/itemStudio': { prepareSavedCoinPhotos: async () => {} }, '@/lib/itemPhotos': { asRecord: rapidRecord, itemPhotos: row => row.media.map(original => ({ original, presentation: original })) },
  };
  const preparation = loadRapidTypescript('src/lib/rapidCoinPreparation.ts', stubs);
  let current = true; const scope = { client, userId: 'seller', tenantId: 'tenant', nicheId: 'coins', sessionId: 'worker', isCurrent: () => current };
  return { run: () => preparation.prepareRapidCoin(scope, job), calls, job: () => job, item: () => item, inserts: () => inserts, expire: () => { current = false; } };
}
test('three photos generate a complete draft through shared infrastructure despite low visual confidence', async () => {
  const h = harness(); await h.run();
  assert.equal(h.inserts(), 1); assert.equal(h.job().processing, 'ready'); assert.equal(h.job().checkpoint.listingId, 'listing');
  assert.equal(h.job().evidence.transcription, 'Roman / Hadrian? / silver?'); assert.equal(h.item().attributes._rapid_photo_roles[2].role, 'evidence');
  assert.deepEqual(h.job().draft.photos, ['https://fixture.invalid/obverse.jpg', 'https://fixture.invalid/reverse.jpg']);
  assert.equal(h.item().media.length, 3); assert.equal(h.job().draft.price, 45);
  assert.match(h.calls[0].body.acquisitionContext, /PRIMARY research lead/); assert.equal(h.calls[0].body.captureMode, 'item');
  assert.equal(h.calls[0].body.numistaImages.length, 2);
  assert.equal(h.calls.filter(call => call.name === 'shared-draft').length, 1);
});
test('seller-confirmed Numista references are passed to the real direct-catalogue contract', async () => {
  const h = harness({ reference: 'N#438449' }); await h.run(); const known = h.calls[0].body.knownAttributes;
  assert.equal(known.numistaTypeId, 438449); assert.equal(known.catalogueNumber, 'N#438449'); assert.match(known.customNotes, /explicitly confirms Numista/);
  assert.equal(h.job().answers.numista_number, 'N#438449');
});
test('unavailable shared capture configuration does not create a replacement item or invent an identification', async () => {
  const h = harness({ unavailable: true }); await assert.rejects(h.run(), /Profile unavailable/); assert.equal(h.inserts(), 0); assert.equal(h.calls.length, 0); assert.equal(h.job().photos.length, 3);
});
test('changed seller scope stops processing before stock creation', async () => {
  const h = harness(); h.expire(); await assert.rejects(h.run(), /Scope changed/); assert.equal(h.inserts(), 0);
});
