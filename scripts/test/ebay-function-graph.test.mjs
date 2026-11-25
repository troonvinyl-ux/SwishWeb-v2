import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { inspectEbayFunctionGraph } from '../check-ebay-function-graph.mjs';
const entry = 'supabase/functions/swish-ebay-list/index.ts';
async function fixture(t, sources) {
  const root = await mkdtemp(join(tmpdir(), 'swish-delivery-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, source] of Object.entries(sources)) {
    const file = join(root, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, source);
  }
  return root;
}
test('missing shared delivery file fails the graph check before packaging', async t => {
  const root = await fixture(t, { [entry]: "import { deliveryProfileRoute } from '../_shared/deliveryProfileRoutes.ts';" });
  const result = await inspectEbayFunctionGraph(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [{ importer: entry, dependency: '../_shared/deliveryProfileRoutes.ts', reason: 'Missing deployment dependency' }]);
});
test('transitive delivery dependencies and literal dynamic imports are included', async t => {
  const root = await fixture(t, {
    [entry]: "import '../_shared/deliveryProfileRoutes.ts'; export * from '../_shared/security.ts'; import('npm:@supabase/supabase-js@2');",
    'supabase/functions/_shared/deliveryProfileRoutes.ts': "import './deliveryPreferences.ts'; import('./deliveryEligibility.ts');",
    'supabase/functions/_shared/deliveryPreferences.ts': 'export const profile = {};',
    'supabase/functions/_shared/deliveryEligibility.ts': 'export const eligible = false;',
    'supabase/functions/_shared/security.ts': "import './deliveryPreferences.ts';",
  });
  const result = await inspectEbayFunctionGraph(root);
  assert.equal(result.ok, true); assert.equal(result.files.length, 5); assert.deepEqual(result.missing, []);
});
test('a present route does not conceal a missing transitive preference module', async t => {
  const root = await fixture(t, {
    [entry]: "import '../_shared/deliveryProfileRoutes.ts';",
    'supabase/functions/_shared/deliveryProfileRoutes.ts': "import './deliveryPreferences.ts';",
  });
  const result = await inspectEbayFunctionGraph(root);
  assert.equal(result.ok, false); assert.equal(result.missing[0].dependency, './deliveryPreferences.ts');
});
test('cyclic local imports terminate and entrypoint absence is reported safely', async t => {
  const root = await fixture(t, { [entry]: "import './loop.ts';", 'supabase/functions/swish-ebay-list/loop.ts': "import './index.ts';" });
  assert.equal((await inspectEbayFunctionGraph(root)).files.length, 2);
  const empty = await fixture(t, {}), result = await inspectEbayFunctionGraph(empty);
  assert.equal(result.ok, false); assert.equal(result.missing[0].dependency, entry);
});
