import { isNumismaticCategory, numismaticKind, usesNumismaticCategories } from '@/lib/coinCategoryPolicy';
import { coinCategoryContext, coinCategoryMismatch } from '@/lib/coinCategoryContext';
import { coinListingInput } from '@/lib/coinListingInput';
const COIN_SPECIALISTS = new Set(['coins', 'coins_uk', 'coins_world', 'coins_currency', 'numismatic', 'islamic_silver', 'banknotes']);
/** Do not infer the physical object from a decorative portrait or an ambiguous listing title. */
export function coinListingCategoryIssue(form: Record<string, unknown>, item: Record<string, unknown> | null | undefined): string | null {
  if (!item) return null;
  const attributes = coinListingInput(item, form.item_specifics, String(form.title || '')), specialistId = String(item.specialist_id ?? '');
  for (const key of ['country_of_origin', 'year_made', 'period', 'ruler', 'denomination']) if (!attributes[key] && item[key] != null) attributes[key] = item[key];
  const physicalType = String(attributes.object_type ?? attributes.objectType ?? '');
  if (!COIN_SPECIALISTS.has(specialistId) && !(/^(coin|banknote|token|medal|jeton)$/i.test(physicalType) && usesNumismaticCategories('coins', specialistId, attributes))) return null;
  const id = String(form.category_id ?? '').trim();
  if (!/^[1-9]\d*$/.test(id)) return 'Find a relevant eBay coin category before submitting. No category ID will be guessed.';
  const sameStoredCategory = id === String(attributes.ebay_category_id ?? '');
  const name = String(form.category || (sameStoredCategory ? attributes.ebay_category_name : '') || '');
  const path = String(form.category_path || (sameStoredCategory ? attributes.ebay_category_path : '') || '');
  const context = coinCategoryContext(String(form.title ?? item.canonical_title ?? ''), attributes);
  const category = { id, name, categoryPath: path }, mismatch = coinCategoryMismatch(category, context);
  if (mismatch) return `${mismatch} Use Find eBay category to replace it, then check the new condition and item specifics.`;
  if (isNumismaticCategory(category, numismaticKind(attributes, specialistId), context.lot ? 'lot' : 'single')) return null;
  return `“${name || 'The saved category'}” is not a supported category for this numismatic item. Use Find eBay category to replace it, then check the new condition and item specifics.`;
}
