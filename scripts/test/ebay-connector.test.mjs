import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const source = await readFile('src/types/marketplace.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
const { ebayConnectorHeading, readEbayConnector } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`
);

test('marketplace exports the heading helper imported by the GitHub eBay Hub', async () => {
  assert.equal(typeof ebayConnectorHeading, 'function');
  assert.equal(compiled.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const hub = await readFile('src/pages/EbayHub.tsx', 'utf8');
  assert.match(hub, /import \{ readEbayConnector, ebayConnectorHeading \} from '@\/types\/marketplace'/);
});

test('an authorised connector without a recorded seller ID is still connected', () => {
  for (const seller_account_id of [null, '', '   ']) {
    const connector = readEbayConnector({ status: 'connected', seller_account_id });
    assert.equal(ebayConnectorHeading(connector, true, false), 'eBay connected — seller identity not recorded');
  }
});

test('a recorded seller identity is shown only for a saved connected state', () => {
  const connector = readEbayConnector({ status: 'connected', seller_account_id: ' seller-account ' });
  assert.equal(ebayConnectorHeading(connector, true, false), 'seller-account');
  assert.equal(ebayConnectorHeading({ ...connector, status: 'disconnected' }, true, false), 'eBay not connected');
  assert.equal(ebayConnectorHeading(null, true, false), 'eBay not connected');
});

test('workspace and query failures never imply a verified connection', () => {
  const connector = readEbayConnector({ status: 'connected', seller_account_id: 'seller-account' });
  assert.equal(ebayConnectorHeading(connector, false, false), 'SWISH workspace unavailable');
  assert.equal(ebayConnectorHeading(connector, true, true), 'eBay status unavailable');
  assert.equal(ebayConnectorHeading(null, false, true), 'eBay status unavailable');
});

test('owner-triggered identity verification retains confirmed saved readback', async () => {
  const hub = await readFile('src/pages/EbayHub.tsx', 'utf8');
  assert.match(hub, /action: 'verify_connected_identity', tenantId/);
  assert.match(hub, /result\.data\?\.success !== true \|\| result\.data\.verified !== true/);
  assert.match(hub, /const fresh = await query\.refetch\(\)/);
  assert.match(hub, /readEbayConnector\(fresh\.data\?\.\[0\]\)\?\.seller_account_id !== name/);
  assert.match(hub, /onClick=\{\(\) => void verifyLinkedSeller\(\)\}/);
});
