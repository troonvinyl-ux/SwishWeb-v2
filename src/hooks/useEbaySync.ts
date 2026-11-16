import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveNicheId } from '@/lib/niche';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { runNicheEbaySync } from '@/lib/ebaySync';
import type { EbaySyncProgress, EbaySyncResult } from '@/types/ebaySync';

const SYNC_TABLES = ['marketplace_connectors', 'items', 'listings', 'orders', 'sales', 'ebay_messages', 'ebay_returns', 'ebay_cases', 'ebay_offers', 'ebay_financials'];
export function useEbaySync(tenantId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nicheId = getActiveNicheId();
  const key = `${user?.id}:${tenantId}:${nicheId}`;
  const current = useRef(key); current.current = key;
  const mounted = useRef(true);
  const locked = useRef(false);
  const [progress, setProgress] = useState<EbaySyncProgress | null>(null);
  const [syncError, setSyncError] = useState('');
  useEffect(() => { mounted.current = true; locked.current = false; setProgress(null); setSyncError(''); return () => { mounted.current = false; }; }, [key]);
  const mutation = useMutation({
    mutationKey: ['ebay_sync', key], retry: false,
    mutationFn: async (): Promise<EbaySyncResult> => {
      const client = await getSupabaseClientAsync();
      if (!client || !user || !tenantId) throw new Error('Your SWISH workspace is not ready. Complete setup before syncing eBay.');
      const isCurrent = () => mounted.current && current.current === key && getActiveNicheId() === nicheId;
      return runNicheEbaySync(client, user.id, tenantId, nicheId, { isCurrent, onProgress: next => { if (isCurrent()) setProgress(next); } });
    },
    onSuccess: async result => {
      if (!mounted.current || current.current !== key) return;
      await Promise.all(SYNC_TABLES.map(table => qc.invalidateQueries({ queryKey: [table] })));
      if (!mounted.current || current.current !== key) return;
      setProgress(result.data); setSyncError(result.error || '');
      if (result.error) toast.error(result.error);
      else toast.success(`eBay sync complete: ${result.data?.updated ?? 0} listing(s) reconciled.`);
    },
    onError: error => { if (mounted.current && current.current === key) { setSyncError(error.message); toast.error(error.message); } },
  });
  const sync = useCallback(async (): Promise<EbaySyncResult | null> => {
    if (locked.current || mutation.isPending) return null;
    locked.current = true; setSyncError(''); setProgress(null);
    return mutation.mutateAsync().catch(() => null).finally(() => { if (current.current === key) locked.current = false; });
  }, [key, mutation]);
  return { sync, syncing: mutation.isPending, syncError, syncProgress: progress };
}
