import { taxonomyPayload, validatedTaxonomyRow } from '@/lib/ebayTaxonomyResponse';
import { usesNumismaticCategories, isNumismaticCategory, numismaticKind } from '@/lib/coinCategoryPolicy';
import { coinCategoryContext, coinCategoryMismatch } from '@/lib/coinCategoryContext';
import type { CategorySuggestion, CategoryLookupContext, InvokeCategory } from '@/lib/categoryLookup';
/** Only a category/requirements failure allows a new search; auth and stale-scope errors remain fatal. */
export class CategoryVerificationError extends Error {
  constructor(message: string) { super(message); this.name = 'CategoryVerificationError'; }
}
/** Verify the selected ID through SWISH's native live requirements route; never replace it or publish. */
export async function verifyListingCategory(tenantId: string, selected: CategorySuggestion, invoke: InvokeCategory, context: CategoryLookupContext = {}): Promise<CategorySuggestion> {
  const assertCurrent = () => { if (context.isCurrent?.() === false) throw new Error('The listing or workspace changed. No eBay submission was sent.'); };
  assertCurrent();
  if (!tenantId || !/^[1-9]\d*$/.test(selected.id) || !selected.name.trim()) throw new CategoryVerificationError('Choose a named eBay leaf category for this saved draft first.');
  const response = await invoke('swish-ebay-category', { route: 'get_category_aspects', tenantId, ...(context.nicheId ? { nicheId: context.nicheId } : {}), categoryId: selected.id, forceLive: true });
  assertCurrent();
  if (response.error) {
    const message = response.error.displayMessage || response.error.message;
    if (response.error.status === 401 || response.error.status === 403) throw new Error(message);
    throw new CategoryVerificationError(message);
  }
  const metadata = taxonomyPayload(response.data);
  // The native route is bound to EBAY_GB and the requested ID. Older revisions
  // omit echoed IDs/marketplace or return the raw successful eBay aspects body.
  // An aspects array (including []) is positive live leaf evidence, not a guess.
  const row = validatedTaxonomyRow(metadata, { ...selected, categoryPath: selected.categoryPath || '' });
  const liveAspects = Array.isArray(metadata.aspects);
  if (metadata.success === false || metadata.error || row.isLeaf === false || row.isLeaf !== true && !liveAspects) {
    throw new CategoryVerificationError('eBay could not verify the selected UK leaf category. Retry Find eBay category on this saved draft.');
  }
  row.isLeaf = true;
  // Live category labels/ancestry, when supplied, override stale browser labels for the same ID.
  if (usesNumismaticCategories(context.nicheId, context.specialistId, context.attributes)) {
    const facts = coinCategoryContext(context.title || '', context.attributes);
    const mismatch = coinCategoryMismatch({ ...row }, facts);
    if (mismatch || !isNumismaticCategory({ ...row }, numismaticKind(context.attributes, context.specialistId), facts.lot ? 'lot' : 'single')) {
      throw new CategoryVerificationError(`${mismatch || 'The live eBay category does not match this numismatic item.'} Use Find eBay category before submitting.`);
    }
  }
  return { id: row.id, name: row.name, ...(row.categoryPath ? { categoryPath: row.categoryPath } : {}) };
}
