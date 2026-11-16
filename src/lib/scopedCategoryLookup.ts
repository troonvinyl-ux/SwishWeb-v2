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
 attributes: Record<string, unknown>;
 isCurrent: () => boolean;
}
/** Both clients use the existing server-established module. Body identifiers are assertions, never grants. */
export async function lookupScopedListingCategory(input: ScopedCategoryInput) {
 const assertScope = async () => {
  if (!input.isCurrent()) throw new Error('Your workspace or category search changed. Retry from the active item.');
  await verifyModuleScope(input.client, input.userId, input.tenantId, input.nicheId);
 };
 const suggestion = await lookupListingCategory(input.tenantId,
  categorySearchQuery(input.title, input.nicheId, input.attributes),
  async (endpoint, body) => {
   try { await assertScope(); }
   catch (error) { return { data: null, error: { status: 403, message: error instanceof Error ? error.message : 'Module authorization is unavailable.' } }; }
   return callEdgeFunction(endpoint, body, input.client);
  }, { nicheId: input.nicheId, title: input.title, attributes: input.attributes, isCurrent: input.isCurrent });
 await assertScope();
 return suggestion;
}
