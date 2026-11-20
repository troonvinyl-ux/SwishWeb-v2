import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compiled = ts.transpileModule(await readFile('src/lib/listingReadiness.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
const { publicationBlock, permanentListingPhoto, listingReadiness } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
const listing = { id: 'listing-1', item_id: 'item-1', tenant_id: 'tenant-1', title: 'Verified example item', description: 'Visible condition and actual item details.', price: 10, category_id: '123', status: 'draft' };
const input = { listing, item: { id: 'item-1', tenant_id: 'tenant-1', specialist_id: 'coins', status: 'available' }, tenantId: 'tenant-1', specialistIds: ['coins'], photos: ['https://images.example.com/photo.jpg'], dirty: false };
test('recorded listings remain protected; unrecorded operations are delegated to the shared server', () => {
  assert.equal(publicationBlock(listing), null);
  for (const patch of [{ external_listing_id: '1234567890' }, { external_listing_id: 'unexpected' }, ...['active', 'live', 'published', 'sold', 'ended'].map(status => ({ status }))]) assert.ok(publicationBlock({ ...listing, ...patch }));
  for (const patch of [{ publish_claim_id: 'claim' }, ...['verified', 'publishing', 'submitted'].map(status => ({ status }))]) assert.equal(publicationBlock({ ...listing, ...patch }), null);
});
test('local checks never claim category validation or marketplace acceptance', () => {
  assert.equal(listingReadiness(input).filter(check => check.status === 'fail').length, 0);
  assert.equal(listingReadiness(input).find(check => check.id === 'category').status, 'review');
});
test('wrong tenant, niche, item and sold stock fail readiness', () => {
  for (const item of [{ ...input.item, tenant_id: 'tenant-2' }, { ...input.item, specialist_id: 'bicycles' }, { ...input.item, id: 'another-item' }, { ...input.item, status: 'sold' }, { ...input.item, sold_at: '2026-11-14' }]) assert.ok(listingReadiness({ ...input, item }).some(check => check.status === 'fail'));
});
test('invalid numbers, brief titles, unsaved fields and empty photos fail readiness', () => {
  for (const override of [{ listing: { ...listing, price: Infinity } }, { listing: { ...listing, price: -1 } }, { listing: { ...listing, title: 'Short' } }, { dirty: true }, { photos: [] }]) assert.ok(listingReadiness({ ...input, ...override }).some(check => check.status === 'fail'));
});
test('temporary, credentialed and insecure photo URLs are not accepted as permanent', () => {
  assert.equal(permanentListingPhoto(input.photos[0]), true);
  for (const url of ['blob:photo', 'data:image/png;base64,x', 'http://images.example.com/a.jpg', 'https://user:pass@images.example.com/a.jpg', 'https://images.example.com/a.jpg?token=secret']) assert.equal(permanentListingPhoto(url), false);
});
test('submit has an in-flight click guard but no persistent browser lock or AI verification gate', async () => {
  const editor = await readFile('src/hooks/useListingEditorActions.ts', 'utf8');
  assert.match(editor, /working\.current = true/);
  assert.doesNotMatch(editor, /sessionStorage|usePublicationAttempt|swish-verify|human_override|verification\?\.passed|setTimeout/);
  assert.match(editor, /prepareSharedSubmission/);
  assert.match(editor, /publicationBlock/);
  const page = await readFile('src/pages/ListingEditor.tsx', 'utf8');
  assert.match(page, /Submit to eBay/);
  assert.doesNotMatch(page, /ListingReadiness|SellerListingReview|PublishConfirmation|ListingConflictReview/);
});
