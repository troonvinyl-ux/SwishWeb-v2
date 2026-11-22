import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');

test('unsupported web journeys do not appear in desktop or Hub navigation and have a controlled direct-route response', () => {
  const app = source('src/App.tsx');
  const sidebar = source('src/components/layout/Sidebar.tsx');
  const hub = source('src/pages/EbayHub.tsx');
  const header = source('src/components/layout/Header.tsx');
  const removed = ['/stock-check', '/audit', '/money', '/tools', '/ebay/analytics', '/ebay/categories', '/ebay/draft-sync-test', '/tools/listing-preflight', '/tools/islamic-batch', '/tools/silver-batch'];
  for (const path of removed) {
    assert.ok(app.includes('<Route path="' + path + '" element={<NotFound />} />'), 'No controlled fallback for ' + path);
    assert.ok(!sidebar.includes("to: '" + path + "'"), 'Sidebar still advertises ' + path);
    assert.ok(!hub.includes("to: '" + path + "'"), 'eBay Hub still advertises ' + path);
    assert.ok(!header.includes("'" + path + "':"), 'Header still advertises ' + path);
  }
  assert.ok(app.includes('path="/dashboard" element={<Navigate to='));
  assert.ok(!sidebar.includes("to: '/dashboard'"));
  assert.ok(source('src/pages/NotFound.tsx').includes('This web feature is not available'));
  assert.ok(!source('src/pages/NotFound.tsx').includes('console.error'));
});

test('inventory search submits with keyboard or click and consumes changed query strings', () => {
  const header = source('src/components/layout/Header.tsx');
  const inventory = source('src/pages/Inventory.tsx');
  for (const literal of ['<form onSubmit={submitSearch} role="search"', 'type="submit"', 'aria-label="Search inventory"', 'aria-label="Close inventory search"', 'navigate(`/inventory?q=']) {
    assert.ok(header.includes(literal), 'Missing header search control ' + literal);
  }
  assert.ok(inventory.includes('setSearch({ scope, text: externalSearch })'));
  assert.ok(inventory.includes('readNativeInventory'));
  const read = source('src/lib/inventoryNativeRead.ts');
  assert.ok(read.includes('swish_inventory_canonical_rows'));
  assert.ok(read.includes('.range(offset, offset + PAGE_SIZE - 1)'));
  assert.ok(read.includes('projectInventoryRows(rows, tenantId, specialistIds)'));
});

test('admin UI relies on trusted owner-role state, not email matching', () => {
  for (const path of ['src/App.tsx', 'src/components/layout/AppLayout.tsx', 'src/components/layout/Sidebar.tsx', 'src/pages/Settings.tsx', 'src/pages/MasterAdmin.tsx']) {
    assert.ok(source(path).includes('isPlatformOwner'), path);
    assert.ok(!source(path).includes("email?.toLowerCase() === 'troonvinyl@gmail.com'"), path);
  }
  const settings = source('src/pages/Settings.tsx');
  assert.ok(!settings.includes("tab === 'notifications'"));
  assert.ok(!settings.includes("label: 'Notifications'"));
  assert.ok(!settings.includes('Sign Out of All Devices'));
});
