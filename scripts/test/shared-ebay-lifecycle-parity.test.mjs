import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('web publish uses native accepted-ID readback before optional status recovery; never replays AddItem', () => {
  const web = read('src/hooks/useListingEditorActions.ts');
  assert.match(web, /route: 'publish'/);
  assert.match(web, /acceptedExternalId = externalId/);
  assert.match(web, /fresh = await readSubmissionListing\(client, tenantId, id\)/);
  assert.match(web, /fresh = await checkSharedListingStatus/);
  assert.match(web, /stock\.data\.status/);
  assert.match(web, /Do not submit again/);
});
test('web End invokes existing native backend and requires exact confirmed saved Ended state', () => {
  const recovery = read('src/lib/listingStatusRecovery.ts');
  const buttons = read('src/components/features/InventoryListingActions.tsx');
  const page = read('src/pages/Listings.tsx');
  const native = read('src/lib/listingStatusRecovery.ts');
  assert.match(recovery, /route: 'end'/);
  assert.match(recovery, /data\?\.confirmed !== true/);
  assert.match(recovery, /result\.data\.status !== 'ended'/);
  assert.match(buttons, /endSharedEbayListing/);
  assert.match(page, /<EndEbayListingAction/);
  assert.match(native, /swish-ebay-listing-status/);
});
test('web inventory reads server-authoritative canonical tabs, not an optimistic local status', () => {
  assert.match(read('src/lib/inventoryNative.ts'), /row\.inventory_tab/);
  assert.match(read('src/lib/inventoryNativeRead.ts'), /swish_inventory_tab_counts/);
  assert.doesNotMatch(read('src/components/features/InventoryListingActions.tsx'), /from\('listings'\)\.update\(\{\s*status/);
});
