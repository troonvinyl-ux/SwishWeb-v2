import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
async function load(path, rewrite = value => value) {
  const output = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(rewrite(output)).toString('base64')}`);
}
const photos = await load('src/lib/itemPhotos.ts');
globalThis.__itemPhotoFixture = photos;
const pricing = await load('src/lib/itemPricing.ts', value => 'const { asRecord } = globalThis.__itemPhotoFixture;\n' + value.replace(/^import[^\n]*;\n/gm, ''));
delete globalThis.__itemPhotoFixture;
const original = 'https://example.com/original.jpg', cutout = 'https://example.com/studio/presentation.png';
const studio = { version: photos.STUDIO_VERSION, status: 'ready', originalUri: original, enhancedUri: cutout, quality: { sourcePixelsOnly: true, fidelityPassed: true } };
test('native saved cutouts are used without overwriting or reordering original evidence', () => {
  const item = { media: [original], image_url: original, attributes: { _smart_studio_images: { front: studio } } };
  assert.deepEqual(photos.itemPhotos(item), [{ original, presentation: cutout, prepared: true }]);
  assert.deepEqual(photos.availableItemPhotos(item), [cutout, original]);
  assert.deepEqual(item.media, [original]);
});
test('failed, old and unverified presentations fall back to the original; generative references are excluded', () => {
  for (const invalid of [{ ...studio, status: 'fallback' }, { ...studio, version: 'old' }, { ...studio, quality: {} }]) {
    const item = { media: [original, cutout, 'https://example.com/references/ai.png'], attributes: { _smart_studio_images: { front: invalid } } };
    assert.deepEqual(photos.itemPhotos(item), [{ original, presentation: original, prepared: false }]);
  }
});
test('actual marketplace price, suggested price and market value remain separate; unknown is not zero', () => {
  assert.deepEqual(pricing.itemPricing({ valuation_mid: 100, expected_selling_price: 95, acquired_cost: 10 }, { price: 172.76 }), { market: 100, suggested: 95, actual: 172.76, cost: 10, low: null, high: null });
  assert.equal(pricing.itemPricing({ valuation_mid: 0 }).market, null);
  assert.equal(pricing.itemPricing({ expected_selling_price: 95 }).actual, null);
  assert.equal(pricing.positiveMoney(undefined, '', NaN, -1), null);
});
test('photo preparation reuses the existing scoped gateway and changes only CAS-protected presentation metadata', async () => {
  const source = await readFile('src/lib/itemStudio.ts', 'utf8');
  assert.match(source, /swish-coin-image-enhance/); assert.match(source, /verifyModuleScope/);
  assert.match(source, /_smart_studio_images/); assert.match(source, /eq\('updated_at', fresh.data.updated_at\)/);
  assert.doesNotMatch(source, /update\(\{\s*media|swish-ebay-list/);
});
test('listing read view and editor have distinct routes; Re-ID uses originals and never rewrites eBay', async () => {
  const app = await readFile('src/App.tsx', 'utf8'), intelligence = await readFile('src/hooks/useItemIntelligence.ts', 'utf8');
  assert.match(app, /path="\/listings\/:id" element=\{<ListingDetails/);
  assert.match(app, /path="\/listings\/:id\/edit" element=\{<ListingEditor/);
  assert.match(intelligence, /photo\.original/); assert.match(intelligence, /applyToItem: true/);
  assert.doesNotMatch(intelligence, /swish-ebay-list|from\('listings'\)\.update/);
});
