import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');

test('removed unsupported web journeys have no sidebar or eBay Hub links and use controlled direct-route responses', () => {
  const app = source('src/App.tsx');
  const sidebar = source('src/components/layout/Sidebar.tsx');
  const hub = source('src/pages/EbayHub.tsx');
  const header = source('src/components/layout/Header.tsx');
  const withheld = ['/stock-check', '/audit', '/money', '/tools', '/ebay/analytics', '/ebay/categories', '/ebay/draft-sync-test', '/tools/listing-preflight', '/tools/islamic-batch', '/tools/silver-batch'];
  for (const route of withheld) {
    assert.match(app, new RegExp('path="' + route.replaceAll('/', '\\/') + '" element=\\{<NotFound \\/>\\}'), 'No controlled fallback for ' + route);
    assert.ok(!sidebar.includes("to: '" + route + "'"), 'Sidebar still advertises ' + route);
    assert.ok(!hub.includes("to: '" + route + "'"), 'eBay Hub still advertises ' + route);
    assert.ok(!header.includes("'" + route + "':"), 'Header still advertises ' + route);
  }
  assert.match(app, /path="\\/dashboard" element=\\{<Navigate to=/);
  assert.ok(!sidebar.includes("to: '/dashboard'"), 'Dead Dashboard sidebar link');
  assert.match(source('src/pages/NotFound.tsx'), /This web feature is not available/);
  assert.doesNotMatch(source('src/pages/NotFound.tsx'), /console\\.error/);
});

test('web header has a real clickable search form and Inventory honours the URL search query', () => {
  const header = source('src/components/layout/Header.tsx');
  const inventory = source('src/pages/Inventory.tsx');
  assert.match(header, /<form onSubmit=\\{submitSearch\\} role="search"/);
  assert.match(header, /type="submit"/);
  assert.match(header, /aria-label="Search inventory"/);
  assert.match(header, /aria-label="Close inventory search"/);
  assert.match(header, /navigate\\(\\`\\/inventory\\?q=/);
  assert.match(inventory, /useEffect\\(\\(\\) => \\{ setSearch\\(externalSearch\\); \\}, \\[externalSearch\\]\\)/);
  assert.match(inventory, /allPages: true/);
});

test('web master menu uses the authenticated server owner role, not privileged email comparisons', () => {
  for (const path of ['src/App.tsx', 'src/components/layout/AppLayout.tsx', 'src/components/layout/Sidebar.tsx', 'src/pages/Settings.tsx', 'src/pages/MasterAdmin.tsx']) {
    assert.match(source(path), /isPlatformOwner/, path);
    assert.doesNotMatch(source(path), /email\\?\\.toLowerCase\\(\\) === ['"]troonvinyl@gmail.com['"]/, path);
  }
  const settings = source('src/pages/Settings.tsx');
  assert.doesNotMatch(settings, /tab === 'notifications'|label: 'Notifications'/);
  assert.doesNotMatch(settings, /Sign Out of All Devices/);
});
