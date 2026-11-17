import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const OWNER_AWARE_SOURCES = [
  "src/App.tsx",
  "src/components/layout/AppLayout.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/pages/Dispatch.tsx",
  "src/pages/EbayAnalytics.tsx",
  "src/pages/Identify.tsx",
  "src/pages/MasterAdmin.tsx",
  "src/pages/NicheCapture.tsx",
  "src/pages/NicheEntry.tsx",
  "src/pages/NicheWorkspace.tsx",
  "src/pages/Onboarding.tsx",
  "src/pages/Settings.tsx"
];

test('website resolves owner access through the trusted SWISH role RPC', async () => {
  const authContext = await readFile('src/contexts/AuthContext.tsx', 'utf8');
  assert.match(authContext, /rpc\('swish_is_platform_owner'\)/);
  assert.match(authContext, /isPlatformOwnerLoading/);
  assert.match(authContext, /data === true/);
  for (const path of OWNER_AWARE_SOURCES) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /isPlatformOwner/);
    assert.doesNotMatch(source, /OWNER_EMAIL/);
    assert.doesNotMatch(source, /email\?\.toLowerCase\(\)\s*===/);
  }
});
