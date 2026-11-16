import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = await readFile('src/lib/categoryLookup.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { lookupListingCategory, categorySearchQuery, isRecordedMusicCategory } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
const suggestion = { id: '176985', name: 'CDs', isLeaf: true };
const ok = (suggestions = [suggestion]) => ({ data: { success: true, suggestions }, error: null });

test('uses the dedicated category service with the signed-in tenant', async () => {
  const calls = [];
  const result = await lookupListingCategory('tenant-1', 'Artist Album CD', async (endpoint, body) => { calls.push({ endpoint, body }); return ok(); });
  assert.deepEqual(result, { id: '176985', name: 'CDs' });
  assert.deepEqual(calls, [{ endpoint: 'swish-ebay-category', body: { route: 'get_category_suggestions', tenantId: 'tenant-1', query: 'Artist Album CD' } }]);
});
test('falls back once when the dedicated endpoint is absent, fails or has no leaf result', async () => {
  for (const first of [{ data: null, error: { message: 'Not found', status: 404 } }, { data: { success: false, error: 'Taxonomy unavailable' }, error: null }, ok([]), ok([{ ...suggestion, isLeaf: false }])]) {
    const calls = [];
    const result = await lookupListingCategory('tenant-1', 'Album CD', async endpoint => { calls.push(endpoint); return calls.length === 1 ? first : ok(); });
    assert.equal(result.name, 'CDs');
    assert.deepEqual(calls, ['swish-ebay-category', 'swish-ebay-list']);
  }
});
test('does not fall back across an authorization denial', async () => {
  let calls = 0;
  await assert.rejects(lookupListingCategory('tenant-1', 'Album CD', async () => { calls++; return { data: null, error: { status: 403, message: 'Membership required' } }; }), /Membership required/);
  assert.equal(calls, 1);
});
test('rejects non-leaves, malformed IDs and unsuccessful responses', async () => {
  for (const row of [{ ...suggestion, isLeaf: false }, { ...suggestion, id: 'unknown' }, { ...suggestion, id: '' }, { ...suggestion, name: '' }]) await assert.rejects(lookupListingCategory('tenant-1', 'Album CD', async () => ok([row])), /Category lookup unavailable/);
  await assert.rejects(lookupListingCategory('tenant-1', 'Album CD', async () => ({data:{success:false,suggestions:[suggestion]},error:null})), /Category lookup unavailable/);
});
test('missing tenant or title never sends a request', async () => {
  const invoke = async () => { throw new Error('Must not invoke'); };
  await assert.rejects(lookupListingCategory(null, 'Album CD', invoke), /workspace/);
  await assert.rejects(lookupListingCategory('tenant-1', '', invoke), /title/);
});
test('Tunes search carries real music format and bounds the eBay query', () => {
  assert.equal(categorySearchQuery('Artist Album', 'tunes_flip', { format: 'CD box set' }), 'music CD Artist Album');
  assert.equal(categorySearchQuery('Artist Album', 'tunes_flip', { format: 'Vinyl LP' }), 'vinyl record Artist Album');
  assert.equal(categorySearchQuery('Artist Album', 'tunes_flip'), 'music Artist Album');
  assert.equal(categorySearchQuery('Roman coin', 'coins'), 'Roman coin');
  assert.equal(categorySearchQuery('A'.repeat(150), 'tunes_flip', { format: 'CD' }).length, 100);
});
test('new and saved listing screens use the shared lookup; music avoids coin defaults', async () => {
  for (const page of ['ListingNew', 'ListingEditor']) {
    const source = await readFile(`src/pages/${page}.tsx`, 'utf8');
    assert.match(source, /await lookupScopedListingCategory/);
    assert.match(source, /const nicheId = getActiveNicheId\(\)/);
    assert.match(source, /categoryTitleRef.current !== title/);
    assert.doesNotMatch(source, /route: 'get_category_suggestions'/);
  }
  const source = await readFile('src/pages/ListingNew.tsx', 'utf8');
  assert.match(source, /const mappedCategory = isCoinItem \? mapCoinCategory/);
  assert.match(source, /inv.canonical_title/);
  assert.doesNotMatch(source, /category: 'Coins: British'/);
});

const tunesCD = { nicheId: 'tunes_flip', title: 'Band album CD', attributes: { format: 'CD' } };
const tshirt = { id: '15687', name: 'T-Shirts', isLeaf: true, categoryPath: 'Clothes, Shoes & Accessories > Men > Clothing > T-Shirts' };
test('Tunes skips a top-ranked T-shirt and selects the matching recorded-music category', async () => {
  const result = await lookupListingCategory('tenant-1', 'Band album CD', async () => ok([tshirt, { ...suggestion, categoryPath: 'Music > CDs' }]), tunesCD);
  assert.deepEqual(result, { id: '176985', name: 'CDs' });
});
test('artist merchandise results trigger a bounded format-only retry', async () => {
  const calls = [];
  const result = await lookupListingCategory('tenant-1', 'music CD Band album', async (endpoint, body) => {
    calls.push({endpoint,query:body.query});
    return body.query === 'music CDs' ? ok() : ok([tshirt]);
  }, tunesCD);
  assert.equal(result.name, 'CDs');
  assert.deepEqual(calls.map(call => call.query), ['music CD Band album','music CD Band album','music CDs']);
});
test('Tunes never accepts clothing, merchandise, equipment or another recorded format', async () => {
  for (const row of [tshirt, { ...suggestion, name: 'Vinyl Records', categoryPath: 'Music > Vinyl Records' }, { ...suggestion, name: 'CD Players', categoryPath: 'Sound & Vision > CD Players' }, { ...suggestion, name: 'CDs', categoryPath: 'Music Memorabilia > CDs' }]) {
    let calls=0;
    await assert.rejects(lookupListingCategory('tenant-1', 'Band album', async () => {calls++;return ok([row]);}, tunesCD), /recorded-music category/);
    assert.equal(calls,4);
  }
});
test('music relevance does not change clothing workflows', async () => {
  assert.deepEqual(await lookupListingCategory('tenant-1','Band shirt',async()=>ok([tshirt]),{nicheId:'clothing'}),{id:'15687',name:'T-Shirts'});
});
test('known music leaf labels work without paths; unknown names require a music path', () => {
  assert.equal(isRecordedMusicCategory({name:'CDs'},'cd'),true);
  assert.equal(isRecordedMusicCategory({name:'Vinyl Records'},'vinyl'),true);
  assert.equal(isRecordedMusicCategory({name:'Cassettes'},'cassette'),true);
  assert.equal(isRecordedMusicCategory({name:'Other Formats',categoryPath:'Music > Other Formats'},null),true);
  assert.equal(isRecordedMusicCategory({name:'T-Shirts'},null),false);
  assert.equal(isRecordedMusicCategory({name:'Other Formats',categoryPath:'Music > Other Formats'},'cd'),false);
});

test('module identity is sent to category services; changed searches cannot apply results', async () => {
  const calls = [];
  await lookupListingCategory('tenant-1','Band album',async (endpoint,body)=>{calls.push(body);return ok();},tunesCD);
  assert.equal(calls[0].nicheId,'tunes_flip');
  let current=true, attempted=0;
  await assert.rejects(lookupListingCategory('tenant-1','Band album',async()=>{attempted++;current=false;return ok();},{...tunesCD,isCurrent:()=>current}),/workspace/);
  assert.equal(attempted,1);
});
