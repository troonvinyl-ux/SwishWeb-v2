import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
// Syntax regression only. Full typechecking/build remain the separate CI steps.
const files = [
  'src/lib/scanMarketResearch.ts', 'src/lib/scanListingFields.ts', 'src/lib/scanListingEnrichment.ts',
  'src/lib/quickCaptureFlow.ts', 'src/lib/capturePersistence.ts', 'src/lib/listingEditorSave.ts',
  'src/lib/listingEditorMetadata.ts', 'src/lib/musicPersistence.ts', 'src/lib/musicListing.ts',
  'src/lib/musicQuickSale.ts', 'src/hooks/useListingMarketValue.ts', 'src/hooks/useQuickCapture.ts',
  'src/hooks/useMusicSale.ts', 'src/hooks/useStudioHandoff.ts', 'src/types/capture.ts', 'src/types/music.ts',
  'src/pages/ListingStudio.tsx', 'src/pages/ListingEditor.tsx', 'src/pages/TunesCapture.tsx',
  'src/pages/NicheCapture.tsx', 'src/pages/NicheWorkspace.tsx',
  'src/components/features/QuickCaptureWorkspace.tsx', 'src/components/features/ListingMarketSummary.tsx',
  'src/components/features/ListingCategoryFields.tsx', 'src/components/features/ListingSaleFields.tsx',
];
test('Studio-to-prefilled-listing files transpile without syntax diagnostics', () => {
  for (const file of files) {
    const result = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      reportDiagnostics: true, fileName: file,
    });
    assert.equal(result.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error).length || 0, 0, file);
  }
});
