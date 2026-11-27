import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript, rapidFixture, rapidRecord, rapidText, rapidStrings } from './lib/load-rapid-typescript.mjs';
const packet = { transcript: 'Hungary\n1673\nLeopold I\n3 Kreuzers\nAR.', fields: { ruler: { value: 'Leopold I', quote: 'Leopold I', uncertain: false }, year: { value: '1673', quote: '1673', uncertain: false }, denomination: { value: '3 Kreuzers', quote: '3 Kreuzers', uncertain: false } }, limitations: [] };
function harness({ reference = '', unavailable = false, missingEnvelope = false, nativePacket = false, readFailure = '' } = {}) {
  let job = rapidFixture(1, { answers: { numista_number: reference, notes: 'Collector ticket supplied' }, processing: 'processing', lease: { owner: 'worker', until: Date.now() + 180000 } }), inserts = 0, calls = [];
  let item = null;
  const photos = job.photos.map(photo => ({ ...photo, file: {}, preview: '' }));
  const client = { from: table => {
    assert.equal(table, 'items'); let patch;
    const q = { select: () => q, eq: () => q, update: value => { patch = value; return q; }, single: async () => ({ data: item, error: null }), maybeSingle: async () => { if (patch) item = { ...item, ...patch }; return { data: item, error: null }; } }; return q;
  } };
  const capture = { captureRecord: rapidRecord, captureText: rapidText, captureStrings: rapidStrings, assertCaptureScope: async scope => { if (!scope.isCurrent()) throw Error('Scope changed'); }, captureRequest: async (scope, name, body) => {
    calls.push({ name, body });
    if (readFailure && body.slots?.[0] === 'envelope') throw Error(readFailure);
    if (nativePacket) return { identification: { canonicalTitle: 'Leopold I 3 Kreuzers 1673', specialistId: 'coins', objectType: 'coin', attributes: { _coin_packet: packet, photo_roles: [] } } };
    if (missingEnvelope && body.slots?.[0] === 'envelope') return { identification: { canonicalTitle: 'Russian 5 kopeks 1759', specialistId: 'coins', objectType: 'coin', attributes: { collector_envelope: { transcription: 'Russia / 5 kopeks / 1759', fields: [{ name: 'country', value: 'Russia', source: 'collector' }, { name: 'denomination', value: '5 kopeks', source: 'collector' }, { name: 'date', value: 1759, source: 'collector' }], discrepancies: [] } } } };
    return { identification: { canonicalTitle: missingEnvelope ? 'Unidentified coin' : 'Attributed Roman portrait coin', specialistId: 'coins', objectType: 'coin', confidence: .1, condition: 'Used', attributes: { collector_envelope: missingEnvelope ? {} : { transcription: 'Roman / Hadrian? / silver?', fields: [{ name: 'ruler', value: 'Hadrian?', source: 'collector', note: 'Question mark' }], discrepancies: ['Mint mark not visible'] }, photo_roles: [{ slotId: 'envelope', role: 'coin' }] } } };
  } };
  const policy = loadRapidTypescript('src/lib/rapidCoinPolicy.ts', { '@/lib/captureRequest': capture, '@/lib/listingPresentation': { listingDescriptionText: String } });
  const numista = loadRapidTypescript('src/lib/numistaCapture.ts');
  const database = { changeRapidJob: async (id, scope, update) => { assert.equal(id, job.id); assert.equal(scope, job.scope); job = update(job); return job; } };
  const lead = loadRapidTypescript('src/lib/collectorEnvelopeLead.ts', { '@/lib/captureRequest': capture });
  const read = loadRapidTypescript('src/lib/readCollectorEnvelope.ts', { '@/lib/captureRequest': capture, '@/lib/rapidCoinPolicy': policy, '@/lib/numistaCapture': numista });
  const persist = loadRapidTypescript('src/lib/persistCollectorEnvelope.ts', { '@/lib/captureRequest': capture, '@/lib/collectorEnvelopeLead': lead, '@/lib/captureDraftRecovery': { readOriginalCaptureDraft: async () => null }, '@/lib/rapidCoinDatabase': database });
  const stubs = {
    '@/lib/captureRequest': capture, '@/lib/sharedScanPhotos': { prepareScanPhotos: async photos => ({ images: photos.map(() => 'data:image/jpeg;base64,YQ=='), slots: photos.map(p => p.slotId), imageLabels: photos.map(p => p.label) }) },
    '@/lib/nativeCaptureProfiles': { loadCaptureProfile: async () => { if (unavailable) throw Error('Profile unavailable'); return { modes: [{ id: 'item' }] }; } },
    '@/lib/numistaCapture': { ...numista, prepareNumistaFaces: async () => [{ label: 'Obverse', image_data: 'YQ==' }, { label: 'Reverse', image_data: 'YQ==' }] },
    '@/lib/coinListingGate': { assertCoinDraftReady: answers => numista.parseNumistaNumber(answers.numista_number), canonicalCoinReferenceAnswers: (answers, id) => ({ ...answers, numista_type_id: String(id) }) },
    '@/lib/rapidCoinPhotos': { loadRapidPhotos: async () => photos, uploadRapidOriginals: async (scope, current, original, keep) => { const urls = Object.fromEntries(original.map(p => [p.slotId, `https://fixture.invalid/${p.slotId}.jpg`])); await keep(urls); return urls; } },
    '@/lib/rapidCoinDatabase': database,
    '@/lib/capturePersistence': { persistCaptureItem: async (scope, result, specialist, answers, mode, id) => { assert.equal(id, job.id); assert.equal(mode, 'item'); inserts++; item = { id, tenant_id: 'tenant', canonical_title: result.canonicalTitle, attributes: result.attributes, media: [], updated_at: 'version' }; return id; } },
    '@/lib/listingStudioPreparation': { prepareStableQuickCapture: async options => { calls.push({ name: 'shared-draft', body: options }); assert.equal(options.stableItemId, job.id); await options.onCheckpoint({ ...job.checkpoint, listingId: 'listing' }); item.media = Object.values(job.checkpoint.photos); return { itemId: job.id, listingId: 'listing', title: options.checkpoint.identification.canonicalTitle, description: 'Original coin shown.', price: 45, photos: options.buyerSlots.map(slot => job.checkpoint.photos[slot]), warnings: [] }; } },
    '@/lib/rapidCoinPolicy': policy, '@/lib/itemPhotos': { asRecord: rapidRecord, itemPhotos: row => row.media.map(original => ({ original, presentation: original })) },
    '@/lib/collectorEnvelopeLead': lead, '@/lib/readCollectorEnvelope': read, '@/lib/persistCollectorEnvelope': persist,
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
  assert.ok(h.calls[0].body.acquisitionContext.length < 500); assert.match(h.calls[0].body.knownAttributes.customNotes, /PRIMARY research lead/); assert.equal(h.calls[0].body.captureMode, 'item');
  assert.equal(h.calls[0].body.numistaImages.length, 2);
  assert.equal(h.calls.filter(call => call.name === 'shared-draft').length, 1);
});
test('missing envelope OCR is reread once from full saved originals before the same coin draft is prepared', async () => {
  const h = harness({ missingEnvelope: true }); await h.run();
  const reads = h.calls.filter(call => call.name === 'swish-identify'); assert.equal(reads.length, 2);
  assert.deepEqual(reads[1].body.images, ['https://fixture.invalid/envelope.jpg', 'https://fixture.invalid/obverse.jpg', 'https://fixture.invalid/reverse.jpg']);
  assert.equal(h.inserts(), 1); assert.equal(h.job().checkpoint.itemId, 'coin-1'); assert.equal(h.job().checkpoint.envelopeReadAttempted, true);
  assert.equal(h.job().evidence.transcription, 'Russia / 5 kopeks / 1759'); assert.equal(h.item().attributes._collector_research_fields.country, 'Russia');
  assert.match(h.job().draft.title, /Russian 5 kopeks 1759/); assert.equal(h.job().answers.numista_number, '');
});
test('native SWISH packet OCR avoids a duplicate read and supplies collector-labelled listing evidence', async () => {
  const h = harness({ nativePacket: true }); await h.run();
  assert.equal(h.calls.filter(call => call.name === 'swish-identify').length, 1);
  assert.equal(h.job().evidence.transcription, packet.transcript); assert.equal(h.job().checkpoint.envelopeReadAttempted, undefined);
  assert.equal(h.item().attributes.country, 'Hungary'); assert.equal(h.item().attributes.year, '1673');
  assert.equal(h.item().attributes.denomination, '3 Kreuzers'); assert.equal(h.inserts(), 1);
});
test('retained native packet response is reused without any additional identification request', async () => {
  const h = harness(); h.job().checkpoint.identification = { canonicalTitle: 'Leopold I 3 Kreuzers 1673', specialistId: 'coins', attributes: { _coin_packet: packet } };
  await h.run(); assert.equal(h.calls.filter(call => call.name === 'swish-identify').length, 0);
  assert.equal(h.job().evidence.transcription, packet.transcript); assert.equal(h.inserts(), 1);
});
test('only the old explicit context rejection is automatically retried after the transport fix', async () => {
  const h = harness({ missingEnvelope: true }); Object.assign(h.job().checkpoint, { identification: { canonicalTitle: 'Unidentified coin', specialistId: 'coins', attributes: {} }, envelopeReadAttempted: true, envelopeReadError: 'Acquisition context is invalid or too long.' });
  await h.run(); assert.equal(h.calls.filter(call => call.name === 'swish-identify').length, 1);
  assert.equal(h.job().evidence.transcriptionAvailable, true); assert.ok(h.job().checkpoint.envelopeReadVersion);
  const unknown = harness(); Object.assign(unknown.job().checkpoint, { identification: { canonicalTitle: 'Unidentified coin', specialistId: 'coins', attributes: {} }, envelopeReadAttempted: true, envelopeReadError: 'Timed out; result unknown.' });
  await unknown.run(); assert.equal(unknown.calls.filter(call => call.name === 'swish-identify').length, 0);
});
test('a failed envelope read exposes its actual reason while retaining the editable original draft', async () => {
  const h = harness({ missingEnvelope: true, readFailure: 'Acquisition context is invalid or too long.' }); await h.run();
  assert.equal(h.job().processing, 'ready'); assert.equal(h.inserts(), 1);
  assert.match(h.job().message, /Last read: Acquisition context/); assert.match(h.job().message, /Read envelope again/);
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
