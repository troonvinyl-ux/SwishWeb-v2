import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
async function load(path) {
  const compiled = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}
const { runEbaySyncBatches } = await load('src/lib/ebaySyncBatches.ts');
const { activateModuleScope, verifyModuleScope } = await load('src/lib/moduleScope.ts');
const tenantId = 'tenant-1', nicheId = 'coins', userId = 'user-1';
const cursor = '11111111-1111-4111-8111-111111111111';
const response = (data, error = null) => ({ data, error, requiresReauth: false });
const batch = { success: true, processed: 6, updated: 6, failed: 0, batchComplete: true, nextAfterListingId: cursor };
function client({ current = null, opened = true, rpcError = null, uid = userId } = {}) {
  const calls = [];
  const sb = { auth: { getSession: async () => ({ data: { session: { user: { id: uid } } }, error: null }) }, rpc: async (name, args) => {
    calls.push({ name, args });
    if (rpcError) return { data: null, error: rpcError };
    if (name === 'swish_open_module') { if (opened === true) current = { tenant_id: args.p_tenant_id, niche_id: args.p_niche_id }; return { data: opened, error: null }; }
    return { data: current, error: null };
  } };
  return { sb, calls };
}
test('module activation uses native RPC parameters and confirms server readback', async () => {
  const { sb, calls } = client();
  assert.deepEqual(await activateModuleScope(sb, userId, tenantId, nicheId), { tenant_id: tenantId, niche_id: nicheId });
  assert.deepEqual(calls.find(call => call.name === 'swish_open_module').args, { p_tenant_id: tenantId, p_niche_id: nicheId });
  assert.equal(calls.filter(call => call.name === 'swish_open_module').length, 1);
});
test('already authorized module is verified without redundant activation', async () => {
  const { sb, calls } = client({ current: { tenant_id: tenantId, niche_id: nicheId } });
  await activateModuleScope(sb, userId, tenantId, nicheId);
  assert.equal(calls.some(call => call.name === 'swish_open_module'), false);
});
test('unconfirmed selection, denied RPC and changed sign-in fail closed', async () => {
  for (const options of [{ opened: false }, { opened: null }, { rpcError: { message: 'Permission denied' } }, { uid: 'another-user' }]) {
    const { sb, calls } = client(options);
    await assert.rejects(activateModuleScope(sb, userId, tenantId, nicheId));
    assert.ok(calls.filter(call => call.name === 'swish_open_module').length <= 1);
  }
});
test('sync scope verification never opens or switches a missing/wrong module', async () => {
  for (const current of [null, { tenant_id: 'other', niche_id: nicheId }, { tenant_id: tenantId, niche_id: 'beauty' }]) {
    const { sb, calls } = client({ current });
    await assert.rejects(verifyModuleScope(sb, userId, tenantId, nicheId));
    assert.equal(calls.some(call => call.name === 'swish_open_module'), false);
  }
});
test('native full sync advances disjoint batches and aggregates completed work', async () => {
  const calls = [], progress = [];
  const result = await runEbaySyncBatches({ tenantId, nicheId, onProgress: data => progress.push(data), invoke: async body => {
    calls.push(body); return response(calls.length === 1 ? batch : { success: true, processed: 2, updated: 1, failed: 0, batchComplete: true, nextAfterListingId: null });
  } });
  assert.deepEqual(calls[0], { tenantId, nicheId, mode: 'full', batch: true });
  assert.equal(calls[1].afterListingId, cursor);
  assert.equal(result.data.processed, 8); assert.equal(result.data.updated, 7); assert.equal(result.error, null);
  assert.equal(progress[0].processed, 6);
});
test('transport failures and unconfirmed HTTP success never advance or replay', async () => {
  for (const item of [response(null, 'Sync timed out'), response({ ...batch, success: false }, 'Unconfirmed'), { ...response(batch, 'JWT rejected'), requiresReauth: true }]) {
    let calls = 0;
    const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async () => { calls++; return item; } });
    assert.equal(calls, 1); assert.ok(result.error);
  }
});
test('arbitrary batchComplete cannot bypass unknown failure', async () => {
  let calls = 0;
  const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async () => { calls++; return response({ ...batch, blocked: 1, failed: 1, issues: [{ code: 'unknown' }] }, 'Readback failed'); } });
  assert.equal(calls, 1); assert.ok(result.error);
});
test('only fully accounted-for native eBay policy 21920397 permits a new batch', async () => {
  const calls = [];
  const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async body => {
    calls.push(body); return calls.length === 1 ? response({ ...batch, updated: 5, blocked: 1, failed: 1, issues: [{ code: '21920397' }] }, 'Restricted') : response({ success: true, processed: 1, updated: 1, failed: 0, nextAfterListingId: null });
  } });
  assert.equal(calls.length, 2); assert.equal(calls[1].previousIssues, true);
  assert.equal(result.data.partial, true); assert.match(result.error, /21920397/);
});
test('repeated cursor, invalid cursor and zero-work continuation stop safely', async () => {
  for (const data of [{ ...batch, nextAfterListingId: 'bad' }, { ...batch, processed: 0 }, batch]) {
    let calls = 0;
    const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async () => { calls++; return response(data); } });
    assert.ok(result.error); assert.ok(calls <= 2);
  }
});
test('workspace change stops before another batch while retaining completed totals', async () => {
  let current = true, calls = 0;
  const result = await runEbaySyncBatches({ tenantId, nicheId, isCurrent: () => current, invoke: async () => { calls++; current = false; return response(batch); } });
  assert.equal(calls, 1); assert.equal(result.data.updated, 6); assert.match(result.error, /changed/);
});
test('all web eBay listing sync entry points use the shared runner', async () => {
  const [hub, listings, commands, transport, app] = await Promise.all(['src/hooks/useEbayHubActions.ts', 'src/pages/EbayListings.tsx', 'src/pages/CommandCentre.tsx', 'src/lib/ebaySync.ts', 'src/App.tsx'].map(path => readFile(path, 'utf8')));
  for (const source of [hub, listings, commands]) { assert.match(source, /useEbaySync/); assert.doesNotMatch(source, /callEdgeFunction[^;]*'swish-ebay-sync'/); }
  assert.match(transport, /verifyModuleScope/); assert.match(transport, /105000/); assert.match(transport, /Authorization: `Bearer/);
  assert.match(app, /AuthorizedModule/);
  assert.doesNotMatch(listings, /swish-image-download/);
});
