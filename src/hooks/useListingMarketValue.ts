import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import { researchScanMarket } from '@/lib/scanMarketResearch';
import { asRecord, availableItemPhotos } from '@/lib/itemPhotos';
export function useListingMarketValue(item: Record<string, unknown> | null, userId: string | undefined, tenantId: string | null, nicheId: string) {
  const qc = useQueryClient(), [result, setResult] = useState<Record<string, unknown> | null>(null);
  const key = `${userId}:${tenantId}:${item?.id}`, latest = useRef(key); latest.current = key;
  useEffect(() => { latest.current = key; setResult(null); return () => { latest.current = ''; }; }, [key]);
  const refresh = useMutation({ retry: false, mutationFn: async () => {
    const client = await getSupabaseClientAsync();
    if (!client || !item || !userId || !tenantId || item.tenant_id !== tenantId) throw new Error('Open the saved item in your verified workspace before researching.');
    await verifyModuleScope(client, userId, tenantId, nicheId);
    if (latest.current !== key) throw new Error('The listing changed. Retry from the current draft.');
    const market = await researchScanMarket({ client, userId, tenantId, nicheId, itemId: String(item.id), specialistId: String(item.specialist_id), title: String(item.canonical_title || ''), attributes: asRecord(item.attributes), condition: String(item.condition || ''), imageUrls: availableItemPhotos(item) });
    if (market.error || !market.data) throw new Error(market.error || 'No market estimate returned.');
    await verifyModuleScope(client, userId, tenantId, nicheId);
    return { data: market.data, key };
  }, onSuccess: value => {
    if (latest.current !== value.key) return;
    setResult(value.data); toast.success('Market research updated. Your selling price is unchanged.');
    void qc.invalidateQueries({ queryKey: ['items'] });
  }, onError: (cause: Error) => { if (latest.current === key) toast.error(cause.message); } });
  return { result, refresh };
}
