import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
import { studioFace } from './lib/coin-studio-fixtures.mjs';
globalThis.crypto ||= webcrypto;
const photos = loadRapidTypescript('src/lib/itemPhotos.ts'), contract = loadRapidTypescript('src/lib/coinStudioContract.ts', { '@/lib/itemPhotos': photos });
const originals = ['https://example.test/o.jpg', 'https://example.test/r.jpg'];
function harness({ legacy = false, failed = false, wrongHash = false, wrongUser = false, cached = false } = {}) {
  let requests = 0, saves = 0, copies = 0;
  const faces = originals.map((uri, i) => studioFace(uri, i ? 'reverse' : 'obverse', { sourceHash: createHash('sha256').update(i ? 'b' : 'a').digest('hex') }));
  if (wrongHash) faces[0].sourceHash = 'f'.repeat(64);
  const item = { id: 'coin', tenant_id: 'tenant', specialist_id: 'coins', media: originals, attributes: cached ? { _smart_studio_images: { front: faces[0], back: faces[1] } } : {} };
  const q = { select: () => q, eq: () => q, abortSignal: () => q, single: async () => ({ data: item, error: null }) };
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: wrongUser ? 'another' : 'seller' } } }, error: null }) }, from: () => q };
  const pair = loadRapidTypescript('src/lib/coinStudioPair.ts', {
    '@/lib/itemPhotos': photos, '@/lib/coinStudioContract': contract, '@/lib/niche': { getActiveNicheId: () => 'coins' }, '@/lib/moduleScope': { verifyModuleScope: async () => {} },
    '@/lib/studioImageInput': { studioImageInput: async (uri, _signal, maximum) => { copies++; assert.equal(maximum, 1600); return `data:image/jpeg;base64,${Buffer.from(uri === originals[0] ? 'a' : 'b').toString('base64')}`; } },
    '@/lib/supabase': { getSupabaseClientAsync: async () => client, callEdgeFunction: async (name, body) => { requests++; assert.equal(name, 'swish-coin-image-enhance'); assert.equal(body.route, 'coin_pair'); assert.deepEqual(body.faces.map(face => face.originalUri), originals); return { data: legacy ? { status: 'ready', enhancedUri: 'https://example.test/legacy.png' } : { status: 'ready', presentationVersion: contract.COIN_SNAP_VERSION, pairKey: 'a'.repeat(64), faces }, error: failed ? { displayMessage: 'Unavailable' } : null }; } },
    '@/lib/coinStudioPersistence': { saveCoinStudioPair: async options => { saves++; assert.deepEqual(options.originals, originals); return item; } },
  });
  return { run: () => pair.prepareCoinStudioPair({ userId: 'seller', tenantId: 'tenant', itemId: 'coin', originals, signal: new AbortController().signal }), requests: () => requests, saves: () => saves, copies: () => copies };
}
test('web requests the same shared pair route, fingerprints both source copies and saves only audited matching output', async () => {
  const h = harness(), result = await h.run(); assert.equal(result.prepared, true); assert.equal(h.requests(), 1); assert.equal(h.saves(), 1); assert.equal(h.copies(), 2); assert.deepEqual(result.photos, ['https://example.test/studio/obverse.png', 'https://example.test/studio/reverse.png']);
});
test('legacy replies, service failures and unrelated processing fingerprints fall back to originals, never fabricated success', async () => {
  for (const patch of [{ legacy: true }, { failed: true }, { wrongHash: true }]) { const h = harness(patch), result = await h.run(); assert.equal(result.prepared, false); assert.deepEqual(result.photos, originals); assert.equal(h.saves(), 0); }
});
test('verified persisted pairs avoid repeat provider credits; replacement sign-ins cannot continue processing', async () => {
  const cache = harness({ cached: true }); assert.equal((await cache.run()).prepared, true); assert.equal(cache.requests(), 0); assert.equal(cache.copies(), 0);
  const switched = harness({ wrongUser: true }); await assert.rejects(switched.run(), /Sign-in changed/); assert.equal(switched.requests(), 0); assert.equal(switched.saves(), 0);
});
