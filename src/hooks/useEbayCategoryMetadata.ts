import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import { asRecord } from '@/lib/itemPhotos';
import { normalizeEbayAspects, normalizeEbayConditionPolicy } from '@/lib/ebayMusicContract';
/** Read the same eBay localized aspect values used by the native editor. Never invent an endpoint. */
export function useEbayCategoryMetadata(userId: string | undefined, tenantId: string | null, nicheId: string, categoryId: string) {
  return useQuery({
    queryKey: ['ebay-category-metadata', userId, tenantId, nicheId, categoryId], enabled: Boolean(userId && tenantId && categoryId), staleTime: 300_000, retry: false,
    queryFn: async () => {
      const client = await getSupabaseClientAsync();
      if (!client || !userId || !tenantId) throw new Error('Open your SWISH workspace to load eBay values.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      // Category aspects and condition policies are different SWISH routes.
      // The category-aspects response does NOT include the Sell Metadata policy.
      const [aspectsResult, conditionsResult] = await Promise.all([
        callEdgeFunction<Record<string, unknown>>('swish-ebay-category',
          { route: 'get_category_aspects', tenantId, nicheId, categoryId }, client),
        callEdgeFunction<Record<string, unknown>>('swish-ebay-list',
          { route: 'get_condition_policies', tenantId, nicheId, categoryId }, client),
      ]);
      if (conditionsResult.error) throw conditionsResult.error;
      if (conditionsResult.data?.success !== true) {
        throw new Error(String(conditionsResult.data?.error || 'eBay condition choices are unavailable. Retry the lookup.'));
      }
      const policy = normalizeEbayConditionPolicy(asRecord(conditionsResult.data).policy, categoryId);
      // A failed aspects fetch must not replace verified condition options
      // with a guessed list; keep the two failures distinguishable.
      const aspectError = aspectsResult.error?.message ||
        (aspectsResult.data?.success !== true ? String(aspectsResult.data?.error || 'Category item specifics unavailable.') : '');
      return {
        aspects: aspectError ? [] : normalizeEbayAspects(aspectsResult.data?.aspects),
        conditions: policy.conditions,
        conditionRequired: policy.required,
        aspectError: aspectError || null,
      };
    },
  });
}
