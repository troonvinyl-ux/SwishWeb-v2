import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
import { studioFace } from './lib/coin-studio-fixtures.mjs';
import { extendCoinStudioHandler } from '../install-coin-studio.mjs';
import { readFileSync } from 'node:fs';
const photos = loadRapidTypescript('src/lib/itemPhotos.ts');
const contract = loadRapidTypescript('src/lib/coinStudioContract.ts', { '@/lib/itemPhotos': photos });
const originals = ['https://example.test/obverse.jpg', 'https://example.test/reverse.jpg'];
const faces = originals.map((url, i) => studioFace(url, i ? 'reverse' : 'obverse'));
const response = { status: 'ready', presentationVersion: contract.COIN_SNAP_VERSION, pairKey: 'a'.repeat(64), faces };
test('only matching fully audited professional pairs are automatically accepted', () => {
  assert.equal(contract.verifiedCoinStudioPair(response, originals).length, 2);
  for (const patch of [{ status: 'fallback' }, { presentationVersion: 'legacy' }, { faces: faces.slice(0, 1) }, { faces: [...faces].reverse() }, { faces: [{ ...faces[0], quality: { ...faces[0].quality, sourcePixelsOnly: false } }, faces[1]] }, { faces: [{ ...faces[0], quality: { ...faces[0].quality, maxChannelAdjustment: 20 } }, faces[1]] }]) assert.equal(contract.verifiedCoinStudioPair({ ...response, ...patch }, originals), null);
  assert.equal(contract.verifiedCoinStudioPair(response, [...originals].reverse()), null);
});
test('professional derivatives are preferred while all original photos remain inspectable', () => {
  const item = { media: originals, attributes: { _smart_studio_images: { legacy: { ...faces[0], presentationVersion: 'old', enhancedUri: 'https://example.test/studio/legacy.png' }, front: faces[0], back: faces[1] } } };
  assert.equal(photos.itemPhotos(item)[0].presentation, faces[0].enhancedUri);
  assert.deepEqual(item.media, originals); for (const url of originals) assert.ok(photos.availableItemPhotos(item).includes(url));
  assert.equal(photos.usableStudio({ ...faces[0], quality: { sourcePixelsOnly: true, fidelityPassed: true } }), false);
});
test('installation extends the original authenticated gateway idempotently and fails closed on source drift', () => {
  const fixture = "serveModule(handler); auth.getUser(); SUPABASE_SERVICE_ROLE_KEY; const body=await req.json();const {imageDataUrl,tenantId,nicheId}=body;";
  const installed = extendCoinStudioHandler(fixture); assert.match(installed, /handleCoinStudioPair\(body,/); assert.match(installed, /pairAdmin\.storage\.from\('item-images'\)/); assert.equal(extendCoinStudioHandler(installed), installed);
  assert.throws(() => extendCoinStudioHandler('unverified replacement engine'), /gateway changed/);
});
test('web contains no independent pixel engine, artificial image generation or new publisher', () => {
  const source = readFileSync('src/lib/coinStudioPair.ts', 'utf8');
  assert.match(source, /swish-coin-image-enhance/); assert.match(source, /route: 'coin_pair'/); assert.match(source, /verifyModuleScope/);
  assert.doesNotMatch(source, /getImageData|putImageData|swish-ebay-list|image\/generations|ONSPACE_AI_API_KEY/);
  const engine = readFileSync('supabase/functions/_shared/coinStudioPair.ts', 'utf8'); assert.match(engine, /removeBackgroundBytes/); assert.match(engine, /assessCoinPair/); assert.match(engine, /oppositeFaces/);
});
