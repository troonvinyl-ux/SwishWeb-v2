import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useNicheAccess } from '@/hooks/useNicheAccess';
import { useRapidCoinWorker } from '@/hooks/useRapidCoinWorker';
import { rapidJobs } from '@/lib/rapidCoinDatabase';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface RapidCoinContextValue { jobs: RapidCoinJob[]; scope: string; ready: boolean; error: string; refresh: () => Promise<void>; }
const Context = createContext<RapidCoinContextValue | null>(null);
/** Remains above routes so processing survives navigation; never exposes another seller's local snapshot. */
export function RapidCoinProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(), tenant = useCurrentTenantId(), access = useNicheAccess();
  const userId = user?.id || '', tenantId = tenant.tenantId || '', scope = `${userId}:${tenantId}`;
  const enabled = Boolean(userId && tenantId && access.nicheIds.includes('coins') && !access.error && !tenant.error);
  const [snapshot, setSnapshot] = useState<{ scope: string; jobs: RapidCoinJob[] }>({ scope: '', jobs: [] }), [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!enabled) return;
    await rapidJobs(scope).then(jobs => { setSnapshot({ scope, jobs }); setError(''); }, (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Persistent capture storage is unavailable.'));
  }, [enabled, scope]);
  useEffect(() => { if (enabled && navigator.storage?.persist) void navigator.storage.persist().catch(() => false); }, [enabled]);
  useEffect(() => {
    void refresh(); const timer = setInterval(() => void refresh(), 2000);
    window.addEventListener('swish-rapid-change', refresh);
    return () => { clearInterval(timer); window.removeEventListener('swish-rapid-change', refresh); };
  }, [refresh]);
  useRapidCoinWorker(userId, tenantId, enabled);
  const loaded = snapshot.scope === scope && enabled;
  return <Context.Provider value={{ jobs: loaded ? snapshot.jobs : [], scope, ready: loaded, error, refresh }}>{children}</Context.Provider>;
}
export function useRapidCoins() { const context = useContext(Context); if (!context) throw new Error('Rapid capture requires the scoped SWISH provider.'); return context; }
