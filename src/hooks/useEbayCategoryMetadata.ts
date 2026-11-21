import { useQuery } from '@tanstack/react-query';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import { asRecord } from '@/lib/itemPhotos';
import { normalizeEbayAspects, type EbayCondition } from '@/lib/ebayMusicContract';
/** Read the same eBay localized aspect values used by the native editor. Never invent an endpoint. */
export function useEbayCategoryMetadata(userId: string | undefined, tenantId: string | null, nicheId: string, categoryId: string) {
  return useQuery({
    queryKey: ['ebay-category-metadata', userId, tenantId, nicheId, categoryId], enabled: Boolean(userId && tenantId && categoryId), staleTime: 300_000, retry: false,
    queryFn: async () => {
      const client = await getSupabaseClientAsync();
      if (!client || !userId || !tenantId) throw new Error('Open your SWISH workspace to load eBay values.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-category', { route: 'get_category_aspects', tenantId, nicheId, categoryId }, client);
      if (result.error) throw result.error;
      if (result.data?.error || result.data?.success !== true) throw new Error(String(result.data?.error || 'eBay category values are unavailable.'));
      const policy = asRecord(result.data.conditionPolicy || result.data.condition_policy);
      const raw = policy.itemConditions || result.data.itemConditions || result.data.conditions;
      const conditions: EbayCondition[] = Array.isArray(raw) ? raw.map(value => { const row = asRecord(value); return { id: String(row.conditionId || row.id || ''), label: String(row.conditionDescription || row.label || row.name || '') }; }).filter(row => row.id && row.label) : [];
      return { aspects: normalizeEbayAspects(result.data.aspects), conditions };
    },
  });
}
