import { lookupListingCategory } from '@/lib/categoryLookup';
import type { CategoryLookupContext, CategorySuggestion, InvokeCategory } from '@/lib/categoryLookup';
/** Compatibility entry only. All coin callers use the normal SWISH listing-category service; no private tree walker. */
export function resolveCoinCategory(tenantId: string, text: string, invoke: InvokeCategory, context: CategoryLookupContext): Promise<CategorySuggestion> {
  return lookupListingCategory(tenantId, text, invoke, { ...context, nicheId: 'coins' });
}
