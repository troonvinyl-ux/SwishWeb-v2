import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const paths = [
  'src/pages/ListingEditor.tsx',
  'src/hooks/useListingEditorDraft.ts',
  'src/hooks/useListingEditorActions.ts',
  'src/hooks/useListingEditorSave.ts',
  'src/hooks/useListingCategorySuggestion.ts',
  'src/hooks/useListingPhotoUploads.ts',
  'src/lib/listingSubmission.ts',
  'src/lib/ebayMusicContract.ts',
  'src/hooks/useEbayCategoryMetadata.ts',
  'src/lib/listingEditorSave.ts',
  'src/lib/listingEditorData.ts',
  'src/lib/listingEditorMetadata.ts',
  'src/lib/listingConflicts.ts',
  'src/lib/amendListingConflict.ts',
  'src/lib/scanToLiveTiming.ts',
  'src/components/features/ListingConflictReview.tsx',
  'src/components/features/ListingConflictQuestion.tsx',
  'src/components/features/ListingWorkflowProgress.tsx',
  'src/lib/listingVerification.ts',
  'src/lib/listingStatusRecovery.ts',
  'src/lib/publicationRecovery.ts',
  'src/lib/musicConditionText.ts',
  'src/components/features/ListingEditorPhotos.tsx',
  'src/components/features/ListingPhotoLightbox.tsx',
  'src/components/features/ListingTitleFields.tsx',
  'src/components/features/ListingSaleFields.tsx',
  'src/components/features/ListingCategoryFields.tsx',
  'src/components/features/ListingVerification.tsx',
  'src/components/features/ListingPublishFeedback.tsx',
  'src/components/features/SellerListingReview.tsx',
  'src/components/features/SharedCaptureCamera.tsx',
  'src/components/features/CameraViewport.tsx',
  'src/components/features/CameraPreview.tsx',
];
test('updated editor and camera modules have no TypeScript syntax diagnostics', async () => {
  for (const path of paths) {
    const source = await readFile(path, 'utf8');
    const result = ts.transpileModule(source, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
    assert.deepEqual(result.diagnostics?.filter(value => value.category === ts.DiagnosticCategory.Error) || [], [], path);
  }
});
test('save/refetch preserves dirty edits and reloads the native photo and options metadata', async () => {
  const draft = await readFile('src/hooks/useListingEditorDraft.ts', 'utf8');
  assert.match(draft, /if \(!changed && dirtyRef\.current\) return/);
  assert.match(draft, /attrs\.ebay_listing_media/);
  assert.match(await readFile('src/lib/listingEditorData.ts', 'utf8'), /attrs\.ebay_listing_options/);
  assert.match(draft, /itemVersion: itemRef\.current\?\.updated_at/);
  assert.match(draft, /hydrateListingEditor\(listing\.data, item\)/);
  assert.match(await readFile('src/hooks/useListingEditorSave.ts', 'utf8'), /setQueriesData/);
});
