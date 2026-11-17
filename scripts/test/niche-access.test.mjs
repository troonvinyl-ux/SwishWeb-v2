import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
async function load(path, rewrite = source => source) {
  const compiled = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(rewrite(compiled)).toString('base64')}`);
}
const niche = await load('src/lib/niche.ts');
const ids = Object.keys(niche.NICHE_SPECIALISTS);
globalThis.__nicheAccessFixture = niche;
const { parseNicheEntitlements } = await load('src/lib/nicheEntitlements.ts', source =>
  'const { NICHE_SPECIALISTS } = globalThis.__nicheAccessFixture;\n' + source.replace(/^import[^\n]*;\n/gm, ''));
let invoke;
globalThis.__nicheAccessFixture = { parseNicheEntitlements, callEdgeFunction: (...args) => invoke(...args) };
const { loadVerifiedNicheAccess } = await load('src/lib/nicheAccess.ts', source =>
  'const { parseNicheEntitlements, callEdgeFunction } = globalThis.__nicheAccessFixture;\n' + source.replace(/^import[^\n]*;\n/gm, ''));
delete globalThis.__nicheAccessFixture;
const paid = { subscribed: true, niche_entitlements: ids, is_platform_owner: false };
function fixture() {
  let userId = 'member-A', rpcCalls = 0;
  const client = {
    auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId }, access_token: 'fixture-user-jwt' } : null }, error: null }) },
    rpc: async () => { rpcCalls++; return { data: false, error: null }; },
    from: () => { throw new Error('Configured specialists must never be queried as membership entitlements'); },
  };
  return { client, setUser: id => { userId = id; }, rpcCalls: () => rpcCalls };
}
test('all-niche members see all thirteen products, regardless of configured specialists', async () => {
  const { client, rpcCalls } = fixture();
  invoke = async (endpoint, body, passedClient, options) => {
    assert.equal(endpoint, 'swish-check-subscription');
    assert.deepEqual(body, { tenantId: 'tenant-A' });
    assert.equal(passedClient, client);
    assert.equal(options.headers.Authorization, 'Bearer fixture-user-jwt');
    return { data: paid, error: null };
  };
  assert.deepEqual(await loadVerifiedNicheAccess(client, 'member-A', 'tenant-A'), { nicheIds: ids, owner: false });
  assert.equal(rpcCalls(), 0);
});
test('partial memberships are not expanded; unknown IDs, specialists and wildcard grants are rejected', () => {
  assert.deepEqual(parseNicheEntitlements({ subscribed: true, niche_entitlements: ['coins', 'antiques', 'coins', 'all', '*', 'vinyl_records', 'mx', {}, 'constructor', '__proto__'] }, false), { owner: false, nicheIds: ['coins', 'antiques'] });
  assert.deepEqual(parseNicheEntitlements({ subscribed: false, niche_entitlements: [] }, false).nicheIds, []);
});
test('invalid membership responses surface errors instead of silently showing limited access', () => {
  for (const payload of [null, [], {}, { subscribed: true }, { subscribed: true, niche_entitlements: 'all' }, { subscribed: true, error: 'Verification failed', niche_entitlements: ids }]) {
    assert.throws(() => parseNicheEntitlements(payload, false), /verification|entitlements|Verification/i);
  }
});
test('only verified backend owner status enables every niche on older deployments', async () => {
  const { client } = fixture();
  invoke = async () => ({ data: { subscribed: false, niche_entitlements: [] }, error: null });
  assert.equal((await loadVerifiedNicheAccess(client, 'member-A', 'tenant-A')).nicheIds.length, 0);
  client.rpc = async () => ({ data: true, error: null });
  assert.deepEqual((await loadVerifiedNicheAccess(client, 'member-A', 'tenant-A')).nicheIds, ids);
});
test('authorization errors never fall back to configured specialists', async () => {
  const { client } = fixture();
  invoke = async () => ({ data: null, error: { displayMessage: 'Account access denied (HTTP 403)' } });
  await assert.rejects(loadVerifiedNicheAccess(client, 'member-A', 'tenant-A'), /access denied/);
});
test('changed sign-in blocks dispatch and discards in-flight results', async () => {
  const first = fixture(); first.setUser('member-B');
  invoke = async () => { throw new Error('Must not dispatch'); };
  await assert.rejects(loadVerifiedNicheAccess(first.client, 'member-A', 'tenant-A'), /sign-in changed/);
  const second = fixture();
  invoke = async () => { second.setUser('member-B'); return { data: paid, error: null }; };
  await assert.rejects(loadVerifiedNicheAccess(second.client, 'member-A', 'tenant-A'), /sign-in changed/);
});
test('selector, workspace and both scanners share verified memberships without local grant fallbacks', async () => {
  for (const page of ['NicheEntry', 'NicheWorkspace', 'NicheCapture', 'Identify']) {
    const source = await readFile(`src/pages/${page}.tsx`, 'utf8');
    assert.match(source, /useNicheAccess\(/);
    assert.match(source, /NicheAccessStatus/);
    assert.doesNotMatch(source, /select\('active_specialists'\)|activeSpecialists\.includes/);
  }
  const hook = await readFile('src/hooks/useNicheAccess.ts', 'utf8');
  assert.match(hook, /\['verified_niche_access', user\?\.id, tenant\.tenantId\]/);
  const gate = await readFile('src/components/features/AuthorizedModule.tsx', 'utf8');
  assert.match(gate, /activateModuleScope/);
});
