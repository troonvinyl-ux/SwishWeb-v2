import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = path => readFileSync(path, 'utf8');
test('delivery fieldset does not impose min-content width on the GitHub mobile design', () => {
  const fields = source('src/components/features/ListingSaleFields.tsx');
  assert.match(fields, /<fieldset[^>]+min-w-0 w-full max-w-full/);
  assert.match(fields, /<section hidden=\{section === 'pricing'\}[^>]+min-w-0 max-w-full/);
  assert.match(fields, /\[overflow-wrap:anywhere\]/);
  assert.match(fields, /\[1, 2, 3, 5, 7\]/);
  assert.match(fields, /MusicListingPrice/);
  assert.match(fields, /Buy It Now/); assert.match(fields, /Auction/);
});
test('delivery notices cannot interpolate raw exception messages', () => {
  const policy = source('src/components/features/ListingDeliveryPolicy.tsx'), notice = source('src/components/features/ListingDeliveryErrorNotice.tsx');
  assert.doesNotMatch(policy, /lookup\.error\.message/);
  assert.match(policy, /ListingDeliveryErrorNotice/);
  assert.match(notice, /listingDeliveryError\(error\)/);
  assert.match(notice, /notice\.message/);
  assert.match(notice, /disabled=\{retrying\}/);
});
test('policy query stays tenant/user/niche scoped, disables live lookup and avoids automatic retries', () => {
  const hook = source('src/hooks/useListingDeliveryPolicy.ts');
  assert.match(hook, /queryKey: \['selected-delivery-policy', userId, tenantId, nicheId\]/);
  assert.match(hook, /enabled: Boolean\(userId && tenantId && !externalId\)/);
  assert.match(hook, /retry: false/);
  const service = source('src/lib/listingDeliveryPolicy.ts');
  assert.doesNotMatch(service, /\.from\(|\.update\(|\.insert\(|set_policies|policies\[0\]|coinsInternationalTemplate/);
});
test('delivery changes transpile with existing React and TypeScript conventions', () => {
  for (const path of ['src/types/listingDelivery.ts', 'src/lib/listingDeliveryError.ts', 'src/lib/listingDeliveryPolicy.ts', 'src/hooks/useListingDeliveryPolicy.ts', 'src/components/features/ListingDeliveryErrorNotice.tsx', 'src/components/features/ListingDeliveryPolicy.tsx', 'src/components/features/ListingSaleFields.tsx']) {
    const result = ts.transpileModule(source(path), { fileName: path, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
    assert.equal(result.diagnostics?.filter(value => value.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
  }
  const editor = source('src/pages/ListingEditor.tsx');
  assert.match(editor, /flip-overview-grid/); assert.match(editor, /section === 'delivery'/);
  assert.match(source('src/index.css'), /\.flip-brand span \{color:hsl\(var\(--primary\)\)\}/);
});
