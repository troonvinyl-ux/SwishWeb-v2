import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('web login remains bound to existing SWISH OnSpace Cloud and rejects stale cached public keys', async () => {
  const source = await readFile('src/lib/supabase.ts', 'utf8');
  const validator = await readFile('src/lib/publicBackendKey.ts', 'utf8');
  assert.match(source, /BACKEND_URL = 'https:\/\/iwgaqieyoahmcjfziwga\.backend\.onspace\.ai'/);
  assert.match(validator, /SWISH_BACKEND_REF = 'iwgaqieyoahmcjfziwga'/);
  const build = source.indexOf("{ source: 'build', key: envKey() }");
  const verified = source.indexOf("{ source: 'SWISH fallback', key: COMPILED_ANON_KEY }");
  const staleCache = source.indexOf("{ source: 'browser cache', key: localKey() }");
  assert.ok(build !== -1 && verified > build && staleCache > verified, 'cached key must not override verified SWISH configuration');
  assert.match(source, /validatePublicBackendKey\(key\)/);
});

test('invalid stored sessions recover locally without clearing backend configuration', async () => {
  const source = await readFile('src/contexts/AuthContext.tsx', 'utf8');
  assert.match(source, /function isInvalidStoredSession\(error: unknown\)/);
  assert.match(source, /refresh_token_not_found/);
  assert.match(source, /if \(!isInvalidStoredSession\(error\)\)/);
  assert.match(source, /sb\.auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(source, /applySession\(null\)/);
  assert.doesNotMatch(source, /clearStoredAnonKey\(/);
});

test('login offers manual retry for a real backend or session restoration failure', async () => {
  const source = await readFile('src/pages/LoginPage.tsx', 'utf8');
  assert.match(source, /Could not restore your SWISH session/);
  assert.match(source, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.match(source, />Retry<\/button>/);
});
