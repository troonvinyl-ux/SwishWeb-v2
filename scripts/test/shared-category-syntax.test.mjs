import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const files = ['src/lib/categoryTreeTransport.ts', 'src/lib/coinCategoryNavigation.ts', 'src/lib/browseCoinCategory.ts', 'src/hooks/useListingCategoryBrowser.ts', 'src/components/features/ListingCategoryBrowser.tsx', 'src/lib/selectVerifiedCategory.ts', 'src/lib/ebayTaxonomyResponse.ts', 'src/lib/coinCategoryExclusion.ts', 'src/lib/verifyListingCategory.ts', 'src/hooks/useListingEditorActions.ts', 'src/lib/listingEditorSave.ts', 'src/lib/categoryLookup.ts', 'src/lib/resolveCoinCategory.ts', 'src/lib/coinCategoryPolicy.ts', 'src/lib/coinCategoryContext.ts', 'src/lib/coinCategoryCountry.ts', 'src/lib/coinCategoryDate.ts', 'src/lib/coinCategorySearches.ts', 'src/lib/scopedCategoryLookup.ts', 'src/lib/scanListingEnrichment.ts', 'src/lib/quickCaptureFlow.ts', 'src/lib/coinListingPersistence.ts', 'src/hooks/useEbayCategoryMetadata.ts', 'src/hooks/useListingCategorySuggestion.ts', 'src/hooks/useCoinCategoryAutoselect.ts'];
test('the shared category integration has no TypeScript transpilation syntax diagnostics', () => {
  for (const fileName of files) {
    const result = ts.transpileModule(readFileSync(fileName, 'utf8'), { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
    assert.deepEqual(result.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error) || [], [], fileName);
  }
});
