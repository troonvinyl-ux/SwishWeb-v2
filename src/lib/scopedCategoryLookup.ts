import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import { categorySearchQuery, lookupListingCategory } from '@/lib/categoryLookup';
interface ScopedCategoryInput {
 client: SupabaseClient;
 userId: string;
 tenantId: string;
 nicheId: string;
 title: string;
 specialistId?: string;
 attributes: Record<string, unknown>;
 isCurrent: () => boolean;
}
/** Both clients use the existing server-established module. Body identifiers are assertions, never grants. */
export async function lookupScopedListingCategory(input: ScopedCategoryInput) {
 const assertScope = async () => {
  if (!input.isCurrent()) throw new Error('Your workspace or category search changed. Retry from the active item.');
  await verifyModuleScope(input.client, input.userId, input.tenantId, input.nicheId);
 };
 const savedId = String(input.attributes.ebay_category_id || '').trim();
 const savedName = String(input.attributes.ebay_category_name || '').trim();
 const selectedCategory = savedId && savedName ? { id: savedId, name: savedName, categoryPath: String(input.attributes.ebay_category_path || '') } : undefined;
 const suggestion = await lookupListingCategory(input.tenantId,
  categorySearchQuery(input.title, input.nicheId, input.attributes, input.specialistId),
  async (endpoint, body) => {
   try { await assertScope(); }
   catch (error) { return { data: null, error: { status: 403, message: error instanceof Error ? error.message : 'Module authorization is unavailable.' } }; }
   return callEdgeFunction(endpoint, body, input.client);
  }, { nicheId: input.nicheId, specialistId: input.specialistId, title: input.title, attributes: input.attributes, selectedCategory, isCurrent: input.isCurrent });
 await assertScope();
 return suggestion;
}
