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
    calls.push(body); return calls.length === 1 ? response({ ...batch, success: false, updated: 5, blocked: 1, readSkipped: 0, failed: 1, issues: [{ code: '21920397' }] }, 'Restricted') : response({ success: true, processed: 1, updated: 1, failed: 0, nextAfterListingId: null });
  } });
  assert.equal(calls.length, 2); assert.equal(calls[1].previousIssues, true);
  assert.equal(result.data.partial, true); assert.match(result.error, /21920397/);
});
test('one read-only eBay GetItem timeout does not abandon the remaining linked listings', async () => {
  const calls = [];
  const item = '123456789012';
  const issue = { externalListingId: item, code: 'EBAY_ITEM_READ_TIMEOUT', message: 'Read-only request timed out; original inventory preserved.' };
  const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async body => {
    calls.push(body);
    return calls.length === 1
      ? response({ ...batch, success: false, processed: 6, updated: 5, failed: 1, blocked: 0, readSkipped: 1, issues: [issue], batchComplete: true }, 'One GetItem read timeout')
      : response({ success: true, processed: 4, updated: 4, failed: 0, blocked: 0, nextAfterListingId: null, batchComplete: true });
  } });
  assert.equal(calls.length, 2, 'No timed-out GetItem was retried');
  assert.equal(calls[1].afterListingId, cursor);
  assert.equal(calls[1].previousIssues, true);
  assert.equal(result.data.processed, 10);
  assert.equal(result.data.updated, 9);
  assert.equal(result.data.failed, 1);
  assert.equal(result.data.partial, true);
  assert.equal(result.data.issues[0].externalListingId, item);
  assert.match(result.error, /need attention/);
});
test('an unconfirmed status write cannot use the read-only timeout bypass', async () => {
  const calls = [];
  const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async body => {
    calls.push(body);
    return response({ ...batch, success: false, updated: 5, failed: 1, blocked: 0,
      readSkipped: 1, issues: [{ code: 'SWISH_STATUS_READBACK', externalListingId: '123456789012' }],
      batchComplete: true }, 'Write not confirmed');
  } });
  assert.equal(calls.length, 1);
  assert.ok(result.error);
  assert.equal(result.data.partial, true);
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

test('partial Edge 503 preserves confirmed write counts and identifies one failed listing without another call', async () => {
  const ebayId = '123456789012'; const invocations = []; const updates = [];
  const result = await runEbaySyncBatches({ tenantId, nicheId,
    onProgress: progress => updates.push(progress),
    invoke: async payload => {
      invocations.push(payload);
      if (invocations.length === 1) return response({ ...batch });
      return response({ success: false, partial: true, batchComplete: false, processed: 6,
        updated: 5, failed: 1, blocked: 0, imagesFetched: 0, titlesFixed: 0,
        failedEbayIds: [ebayId], error: '1 listing reconciliations were not confirmed' },
        '[swish-ebay-sync] 1 listing reconciliations were not confirmed (HTTP 503)');
    } });
  assert.equal(invocations.length, 2, 'A failed batch must not be retried or followed by another batch');
  assert.equal(invocations[1].afterListingId, cursor);
  assert.equal(result.data.processed, 12);
  assert.equal(result.data.updated, 11);
  assert.equal(result.data.failed, 1);
  assert.equal(result.data.partial, true);
  assert.equal(result.data.issues[0].externalListingId, ebayId);
  assert.equal(updates.at(-1).failed, 1);
  assert.match(result.error, /503/);
});
test('unknown 503 cannot pretend zero failures were verified or invent an eBay ID', async () => {
  let calls = 0;
  const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async () => {
    calls++; return response(null, 'Backend timeout (HTTP 503)');
  } });
  assert.equal(calls, 1);
  assert.equal(result.data.partial, true);
  assert.deepEqual(result.data.issues, []);
  assert.match(result.error, /503/);
});
test('failed batch with inconsistent counts is not accepted as a confirmed partial outcome', async () => {
  const result = await runEbaySyncBatches({ tenantId, nicheId, invoke: async () => response({
    success: false, partial: true, batchComplete: false, processed: 6, updated: 6, failed: 1,
    imagesFetched: 0, titlesFixed: 0, blocked: 0, failedEbayIds: ['123456789012'],
  }, 'Conflict (HTTP 503)') });
  assert.equal(result.data.updated, 0);
  assert.equal(result.data.failed, 0);
  assert.equal(result.data.partial, true);
});
test('connected eBay consent without stored seller ID never displays disconnected', async () => {
  const { readEbayConnector, ebayConnectorHeading } = await load('src/types/marketplace.ts');
  const connector = readEbayConnector({ status: 'connected', seller_account_id: '',
    access_token_expires_at: '2026-11-22T17:48:00Z' });
  assert.equal(ebayConnectorHeading(connector, true), 'eBay connected — seller ID not recorded');
  assert.equal(ebayConnectorHeading(readEbayConnector({ ...connector, seller_account_id: 'verifiedSeller' }), true), 'verifiedSeller');
  assert.equal(ebayConnectorHeading(null, true), 'No eBay account connected');
  assert.equal(ebayConnectorHeading(connector, false), 'Workspace not ready');
  const [hub, account, ui] = await Promise.all([
    readFile('src/pages/EbayHub.tsx','utf8'), readFile('src/pages/EbayAccount.tsx','utf8'),
    readFile('src/components/features/EbaySyncStatus.tsx','utf8'),
  ]);
  assert.match(hub, /ebayConnectorHeading\(account, Boolean\(tenantId\)/);
  assert.match(account, /ebayConnectorHeading\(connector, Boolean\(tenantId\)/);
  assert.match(ui, /progress\.failed > 0 \? progress\.failed : error && progress\.partial \? 'Unconfirmed'/);
});

test('seller ID can be verified from the existing connector without reconnecting or publishing', async () => {
  const hub = await readFile('src/pages/EbayHub.tsx','utf8');
  assert.match(hub, /action: 'verify_connected_identity', tenantId/);
  assert.match(hub, /onClick=\{\(\) => void verifyLinkedSeller\(\)\}/);
  assert.match(hub, /readEbayConnector\(fresh\.data\?\.\[0\]\)\?\.seller_account_id !== name/);
  assert.match(hub, /isConnected && !account\?\.seller_account_id\?\.trim\(\)/);
  assert.match(hub, /No reconnection was needed/);
  assert.doesNotMatch(hub, /seller_account_id:\s*name/);
});

test('unknown seller-verification action is diagnosed as backend version drift, never a forced reconnect', async () => {
  const hub = await readFile('src/pages/EbayHub.tsx','utf8');
  assert.match(hub, /result\.error\.status === 400 && \/unknown action\/i/);
  assert.match(hub, /SWISH backend update required:/);
  assert.match(hub, /Your existing eBay connection was retained/);
  assert.match(hub, /'swish-ebay-oauth', \{ action: 'verify_connected_identity', tenantId \}/);
  assert.doesNotMatch(hub, /action: 'start_subscriber_authorization'/);
  assert.doesNotMatch(hub, /update\(\{seller_account_id:/);
});

test('eBay member connection confirmation never trusts a pre-existing shared connector',async()=>{
  const [oauth, pending, hub, inventory] = await Promise.all([
    readFile('src/hooks/useEbayOAuthRecovery.ts','utf8'),
    readFile('src/lib/ebayOAuthPending.ts','utf8'),
    readFile('src/pages/EbayHub.tsx','utf8'),
    readFile('src/components/features/InventoryListingActions.tsx','utf8'),
  ]);
  assert.match(oauth, /action:'member_binding_status'/);
  assert.match(oauth, /lastVerifiedAt/);
  assert.match(oauth, /verifiedAt < started - 5000/);
  assert.doesNotMatch(oauth, /from\('marketplace_connectors'\)\.select\('status'\)/);
  assert.match(pending, /export function ebayOAuthStartedAt/);
  assert.match(hub, /Signed-in member:/);
  assert.match(hub, /memberVerified/);
  assert.match(hub, /Connect my eBay account/);
  assert.match(hub, /memberScopeRef\.current !== capturedScope/);
  assert.match(inventory, /Legacy tenant connections are not inherited/);
  assert.match(inventory, /to="\/ebay"/);
});

test('legacy eBay coin card offers local-only archive without changing account binding or marketplace status',async()=>{
  const [actions,detail] = await Promise.all([
    readFile('src/components/features/InventoryListingActions.tsx','utf8'),
    readFile('src/pages/InventoryItem.tsx','utf8'),
  ]);
  assert.match(actions,/This record belongs to a previous or unverified eBay account/);
  assert.match(actions,/Open inventory item for local-only archive/);
  assert.match(actions,/listing\.item_id/);
  assert.match(detail,/mode:'exclude_local_legacy'/);
  assert.match(detail,/Archive locally \(SWISH only\)/);
  assert.match(detail,/from\('listings'\)\.select\('external_listing_id,marketplace_id'\)/);
  assert.ok(detail.includes(String.raw`if (!/^\d{6,20}$/.test(externalId)`));
  assert.ok(!detail.includes(String.raw`if (!/^\\d{6,20}$/.test(externalId)`));
  assert.match(detail,/This does NOT end, delete or verify the eBay listing/);
  assert.match(detail,/response\.data\?\.archived!==true/);
  assert.match(detail,/navigate\('\/inventory\?tab=live'\)/);
});

test('Coins Live has an explicit SWISH-only removal button that never calls eBay End',async()=>{
 const [actions,card] = await Promise.all([
  readFile('src/components/features/InventoryListingActions.tsx','utf8'),
  readFile('src/components/features/InventoryCard.tsx','utf8'),
 ]);
 const begin=actions.indexOf('export function RemoveFromSwishAction(');
 const end=actions.indexOf('export function InventoryPriceAction(',begin);
 assert.ok(begin>0 && end>begin,'dedicated coin local-only action must exist');
 const action=actions.slice(begin,end);
 assert.match(card,/RemoveFromSwishAction entry=\{entry\}/);
 assert.match(card,/nicheId === 'coins'/);
 assert.match(action,/mode:'exclude_local_legacy'/);
 assert.match(action,/Remove from SWISH only/);
 assert.match(action,/eBay item: /);
 assert.match(action,/NO request will be sent to eBay/);
 assert.match(action,/result\.data\?\.archived!==true/);
 assert.match(action,/_swish_ebay_sync_excluded/);
 assert.match(action,/String\(readback\.data\.status\)\.toLowerCase\(\)!=='held'/);
 assert.match(action,/await refresh\(\)/);
 assert.doesNotMatch(action,/endSharedEbayListing/);
 assert.doesNotMatch(action,/EndFixedPriceItem/);
 assert.doesNotMatch(action,/\.from\('items'\)\.delete/);
 assert.doesNotMatch(action,/\.from\('listings'\)\.delete/);
});

test('Coins Live removal control is never silently hidden by historical item status',async()=>{
  const source=await readFile('src/components/features/InventoryListingActions.tsx','utf8');
  const start=source.indexOf('export function RemoveFromSwishAction(');
  const stop=source.indexOf('export function InventoryPriceAction(',start);
  assert.ok(start>0&&stop>start);
  const action=source.slice(start,stop);
  assert.match(action,/data-swish-local-removal="coins"/);
  assert.match(action,/Remove from SWISH only/);
  assert.doesNotMatch(action,/if\(!eligible\)return null/);
  assert.doesNotMatch(action,/!item\.sold_at/);
  assert.doesNotMatch(action,/entry\.tab==='live'/);
  assert.match(action,/disabled=\{!eligible \|\| current\.busy\}/);
  assert.match(action,/unavailableReason/);
  assert.match(action,/mode:'exclude_local_legacy'/);
  assert.doesNotMatch(action,/endSharedEbayListing/);
});

test('one-click verified eBay re-import repairs linked coin ownership instead of creating duplicates',async()=>{
 const [importFlow,ui]=await Promise.all([
  readFile('src/lib/ebaySellerImport.ts','utf8'),
  readFile('src/components/features/EbaySellerDiscovery.tsx','utf8'),
 ]);
 assert.match(importFlow,/export async function repairVerifiedEbaySellerLinks\(/);
 assert.match(importFlow,/route:'repair_seller_links'/);
 assert.match(importFlow,/for\(const section of \['ActiveList','SoldList','UnsoldList'\]/);
 assert.match(importFlow,/await activateModuleScope/);
 assert.match(importFlow,/await verifyModuleScope/);
 assert.match(importFlow,/verifiedSeller/);
 assert.match(importFlow,/externalListingId:candidate\.itemId/);
 assert.match(importFlow,/Number\(binding\.data\.updated\|\|0\)\+Number\(binding\.data\.alreadyLinked\|\|0\)!==1/);
 assert.match(ui,/Re-import & Repair eBay Links/);
 assert.match(ui,/repairVerifiedEbaySellerLinks\(/);
 assert.match(ui,/result\.conflicts/);
 assert.match(ui,/result\.alreadyLinked/);
 assert.match(ui,/result\.unlinked/);
});

test('coin eBay seller repair is directly reachable on the primary Hub, not only the CSV importer',async()=>{
  const [hub, app, repair] = await Promise.all([
    readFile('src/pages/EbayHub.tsx','utf8'),
    readFile('src/App.tsx','utf8'),
    readFile('src/components/features/EbaySellerLinkRepair.tsx','utf8'),
  ]);
  assert.match(app, /<Route path="\/ebay" element=\{<EbayHub \/>\}/);
  assert.match(hub, /<EbaySellerLinkRepair tenantId=\{tenantId\} \/>/);
  assert.match(repair, /data-swish-ebay-repair="coins"/);
  assert.match(repair, /data-testid="ebay-seller-binding-repair"/);
  assert.match(repair, /Re-import & Repair eBay Links/);
  assert.match(repair, /repairVerifiedEbaySellerLinks\(/);
  assert.match(repair, /niche !== 'coins'/);
  assert.match(repair, /No CSV upload/);
  assert.doesNotMatch(repair, /EndFixedPriceItem|AddFixedPriceItem|\.from\('items'\)\.insert/);
});
