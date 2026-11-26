import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import { asRecord } from '@/lib/itemPhotos';
import { normalizeEbayAspects, normalizeEbayConditionPolicy, vinylRecordConditionPolicy, type EbayCondition } from '@/lib/ebayMusicContract';
/** Read the same eBay localized aspect values used by the native editor. Never invent an endpoint. */
export function useEbayCategoryMetadata(userId: string | undefined, tenantId: string | null, nicheId: string, categoryId: string, specialistId = '') {
  return useQuery({
    queryKey: ['ebay-category-metadata', userId, tenantId, nicheId, categoryId, specialistId], enabled: Boolean(userId && tenantId && categoryId), staleTime: 300_000, retry: false,
    queryFn: async () => {
      const client = await getSupabaseClientAsync();
      if (!client || !userId || !tenantId) throw new Error('Open your SWISH workspace to load eBay values.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      // The native EBAY_GB Vinyl Records policy has just New / Used. It is
      // deliberately local so a condition service timeout cannot lock this
      // saved draft; publication still performs the server-side eBay check.
      const vinyl = vinylRecordConditionPolicy(categoryId, specialistId);
      const [aspectsResult, conditionsResult] = await Promise.all([
        callEdgeFunction<Record<string, unknown>>('swish-ebay-category',
          { route: 'get_category_aspects', tenantId, nicheId, categoryId, forceLive: true }, client),
        vinyl ? Promise.resolve(null) : callEdgeFunction<Record<string, unknown>>('swish-ebay-list',
          { route: 'get_condition_policies', tenantId, nicheId, categoryId }, client),
      ]);
      let conditions: EbayCondition[];
      let conditionRequired: boolean;
      if (vinyl) {
        conditions = vinyl.conditions;
        conditionRequired = vinyl.conditionRequired;
      } else {
        if (!conditionsResult || conditionsResult.error) throw conditionsResult?.error || new Error('Current eBay condition policy unavailable.');
        if (conditionsResult.data?.success !== true) throw new Error(String(conditionsResult.data?.error || 'eBay condition choices are unavailable. Retry the lookup.'));
        const policy = normalizeEbayConditionPolicy(asRecord(conditionsResult.data).policy, categoryId);
        conditions = policy.conditions;
        conditionRequired = policy.required;
      }
      const aspectError = aspectsResult.error?.message ||
        (aspectsResult.data?.success !== true || aspectsResult.data?.isLeaf === false ? String(aspectsResult.data?.error || 'Category item specifics unavailable.') : '');
      return { aspects: aspectError ? [] : normalizeEbayAspects(aspectsResult.data?.aspects), conditions, conditionRequired, aspectError: aspectError || null };
    },
  });
}
