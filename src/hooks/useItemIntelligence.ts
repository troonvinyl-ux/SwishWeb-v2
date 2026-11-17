import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { verifyModuleScope } from '@/lib/moduleScope';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
export function useItemIntelligence(item: Record<string, unknown> | null) {
  const { user } = useAuth(), { tenantId } = useCurrentTenantId(), qc = useQueryClient();
  const [candidate, setCandidate] = useState<Record<string, unknown> | null>(null), [market, setMarket] = useState<Record<string, unknown> | null>(null);
  const nicheId = getActiveNicheId(), scope = `${user?.id}:${tenantId}:${nicheId}:${item?.id}`;
  const current = useRef(scope); current.current = scope;
  const controller = useRef<AbortController | null>(null), locked = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { setCandidate(null); setMarket(null); return () => controller.current?.abort(); }, [scope]);
  const live = () => mounted.current && current.current === scope && getActiveNicheId() === nicheId;
  const request = async (kind: 'identify' | 'value') => {
    const client = await getSupabaseClientAsync();
    if (!client || !user || !tenantId || !item || item.tenant_id !== tenantId || !getSpecialistIdsForNiche(nicheId).includes(String(item.specialist_id))) throw new Error('Reopen this item in its verified SWISH workspace.');
    await verifyModuleScope(client, user.id, tenantId, nicheId);
    const photos = itemPhotos(item).map(photo => photo.original).slice(0, 6), attrs = asRecord(item.attributes);
    const title = String(item.canonical_title || '').trim();
    if (kind === 'identify' && !photos.length) throw new Error('Add a saved original photo before re-identifying this item.');
    if (kind === 'value' && title.length < 3) throw new Error('Add an accurate item title before researching value.');
    const flight = new AbortController(); controller.current = flight;
    const timer = setTimeout(() => flight.abort(), 60_000);
    const endpoint = kind === 'identify' ? 'swish-identify' : 'swish-market-value';
    const body = kind === 'identify'
      ? { tenantId, nicheId, specialistId: item.specialist_id, existingImageUrls: photos, knownAttributes: attrs }
      : { tenantId, itemId: item.id, title, specialistId: item.specialist_id, attributes: attrs, condition: item.condition, identificationConfidence: item.identification_confidence, imageUrls: photos, applyToItem: true };
    console.log('[SWISH Item] Requested research', { kind, itemId: item.id });
    const response = await callEdgeFunction<Record<string, unknown>>(endpoint, body, client, { signal: flight.signal }).finally(() => clearTimeout(timer));
    if (response.error) throw new Error(response.error.displayMessage);
    if (current.current !== scope || getActiveNicheId() !== nicheId) throw new Error('Workspace changed. Reopen this item to inspect saved results.');
    await verifyModuleScope(client, user.id, tenantId, nicheId);
    if (!live()) throw new Error('The active item changed. Reopen it to inspect any saved research.');
    if (kind === 'value') {
      if (response.data?.success !== true || !Object.keys(asRecord(response.data.valuation)).length) throw new Error('No verified valuation was returned. No price was inferred.');
      return response.data;
    }
    const result = asRecord(response.data?.identification ?? (Array.isArray(response.data?.candidates) ? response.data.candidates[0] : null));
    if (!Object.keys(result).length) throw new Error('No reviewable identification candidate was returned. Your item is unchanged.');
    return { ...result, _itemUpdatedAt: item.updated_at };
  };
  const run = (kind: 'identify' | 'value') => { if (locked.current) return Promise.reject(new Error('Research is already in progress.')); locked.current = true; return request(kind).finally(() => { locked.current = false; }); };
  const identify = useMutation({ mutationFn: () => run('identify'), onSuccess: value => { if (!live()) return; setCandidate(value); toast.success('Re-ID suggestion ready. No item or eBay fields have changed.'); }, onError: (error: Error) => { if (live()) toast.error(error.message); } });
  const value = useMutation({ mutationFn: () => run('value'), onSuccess: result => { if (!live()) return; setMarket(result); void qc.invalidateQueries({ queryKey: ['items'] }); toast.success('SWISH market research refreshed. eBay price is unchanged.'); }, onError: (error: Error) => { if (live()) toast.error(error.message); } });
  const apply = useMutation({
    mutationFn: async () => {
      const client = await getSupabaseClientAsync(), title = String(candidate?.canonicalTitle || candidate?.title || candidate?.name || '').trim();
      if (!client || !user || !tenantId || !item || !title || !candidate?._itemUpdatedAt || current.current !== scope) throw new Error('Reopen the current item and review its suggestion again.');
      await verifyModuleScope(client, user.id, tenantId, nicheId);
      if (!live()) throw new Error('The active item changed before saving. Reopen and review it again.');
      const saved = await client.from('items').update({ canonical_title: title }).eq('id', item.id).eq('tenant_id', tenantId).in('specialist_id', getSpecialistIdsForNiche(nicheId)).eq('updated_at', candidate._itemUpdatedAt).select('id').maybeSingle();
      if (saved.error || !saved.data) throw new Error(saved.error?.message || 'The item changed. Reload and review again; no automatic overwrite was made.');
    }, onSuccess: () => { if (!live()) return; setCandidate(null); void qc.invalidateQueries({ queryKey: ['items'] }); toast.success('Reviewed title saved to inventory. eBay listing is unchanged.'); }, onError: (error: Error) => { if (live()) toast.error(error.message); },
  });
  return { candidate, market, identify, value, apply, dismiss: () => setCandidate(null) };
}
