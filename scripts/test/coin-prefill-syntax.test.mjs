import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const files = ['src/lib/coinListingFacts.ts', 'src/lib/coinListingInput.ts', 'src/lib/collectorEnvelopeLead.ts', 'src/lib/coinCategoryContext.ts', 'src/lib/categoryLookup.ts', 'src/lib/browseCoinCategory.ts', 'src/lib/scanListingFields.ts', 'src/lib/scanListingEnrichment.ts', 'src/lib/persistCollectorEnvelope.ts', 'src/lib/listingCoinCategory.ts', 'src/lib/listingCategorySelection.ts', 'src/hooks/useListingCategorySuggestion.ts', 'src/hooks/useCoinCategoryAutoselect.ts', 'src/hooks/useCoinSpecificPrefill.ts', 'src/components/features/ListingCoinIdentity.tsx', 'src/pages/ListingEditor.tsx'];
test('Russian coin prefill and category recovery files have no TypeScript syntax diagnostics', () => {
  for (const fileName of files) {
    const result = ts.transpileModule(readFileSync(fileName, 'utf8'), { fileName, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
    const errors = result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) || [];
    assert.deepEqual(errors, [], fileName);
  }
});
