import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { prepareItemStudioPhoto } from '@/lib/itemStudio';
import { getActiveNicheId } from '@/lib/niche';
export function useItemStudio(item: Record<string, unknown> | null) {
  const { user } = useAuth(), { tenantId } = useCurrentTenantId(), qc = useQueryClient();
  const controller = useRef<AbortController | null>(null), mounted = useRef(false), locked = useRef(false);
  const scope = `${user?.id}:${tenantId}:${getActiveNicheId()}:${item?.id}`, current = useRef(scope); current.current = scope;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => () => controller.current?.abort(), [scope]);
  const mutation = useMutation({
    mutationFn: async (original: string) => {
      if (!user || !tenantId || !item || item.tenant_id !== tenantId) throw new Error('Your verified item workspace is not ready.');
      if (locked.current) throw new Error('Photo preparation is already in progress.');
      locked.current = true;
      const flight = new AbortController(); controller.current = flight;
      const timer = setTimeout(() => flight.abort(), 90_000);
      return prepareItemStudioPhoto({ userId: user.id, tenantId, itemId: String(item.id), original, signal: flight.signal }).finally(() => { clearTimeout(timer); locked.current = false; });
    },
    onSuccess: () => { if (!mounted.current || current.current !== scope) return; void qc.invalidateQueries({ queryKey: ['items'] }); toast.success('Background removed. Original photo and eBay listing are unchanged.'); },
    onError: (error: Error) => { if (mounted.current && current.current === scope) toast.error(error.message); },
  });
  return { ...mutation, cancel: () => controller.current?.abort() };
}
