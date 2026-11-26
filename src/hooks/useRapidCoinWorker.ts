import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { activateModuleScope } from '@/lib/moduleScope';
import { claimRapidJob, renewRapidClaim, RAPID_CONCURRENCY } from '@/lib/rapidCoinClaims';
import { rapidJobs, changeRapidJob } from '@/lib/rapidCoinDatabase';
import { prepareRapidCoin } from '@/lib/rapidCoinPreparation';
export function useRapidCoinWorker(userId: string, tenantId: string, enabled: boolean) {
  const active = useRef(new Set<string>()), queries = useQueryClient();
  useEffect(() => {
    if (!enabled || !userId || !tenantId) return;
    let mounted = true, polling = false; const owner = crypto.randomUUID(), scopeKey = `${userId}:${tenantId}`;
    const tick = async () => {
      if (!mounted || polling || active.current.size >= RAPID_CONCURRENCY || getActiveNicheId() !== 'coins' || !navigator.onLine) return;
      polling = true;
      const pending = await rapidJobs(scopeKey).catch(() => []);
      if (!pending.some(job => job.enqueued && (job.processing === 'captured' || job.processing === 'processing' && (job.lease?.until || 0) <= Date.now()))) { polling = false; return; }
      const client = await getSupabaseClientAsync();
      if (!client) { polling = false; return; }
      await activateModuleScope(client, userId, tenantId, 'coins').then(async () => {
        if (!mounted) return;
        const job = await claimRapidJob(scopeKey, owner); if (!job) return;
        active.current.add(job.id); let ownsLease = true;
        const heartbeat = setInterval(() => { void renewRapidClaim(job.id, scopeKey, owner).then(renewed => { ownsLease = renewed; }, () => { ownsLease = false; }); }, 20_000);
        const scope = { client, userId, tenantId, nicheId: 'coins' as const, sessionId: owner, isCurrent: () => mounted && ownsLease && getActiveNicheId() === 'coins' };
        void prepareRapidCoin(scope, job).catch((cause: unknown) => changeRapidJob(job.id, scopeKey, current => current.lease?.owner === owner ? { ...current, processing: 'needs_attention', lease: undefined, message: cause instanceof Error ? cause.message : 'Preparation did not finish. Retry this same capture.' } : current)).finally(() => {
          clearInterval(heartbeat); active.current.delete(job.id);
          void queries.invalidateQueries({ queryKey: ['canonical-inventory'] });
          void queries.invalidateQueries({ queryKey: ['items'] });
        }).catch((cause: unknown) => console.error('[SWISH rapid] Durable recovery unavailable', cause instanceof Error ? cause.message : 'Storage failure'));
      }).catch((cause: unknown) => console.warn('[SWISH rapid] Worker paused', cause instanceof Error ? cause.message : 'Access unavailable')).finally(() => { polling = false; });
    };
    const interval = setInterval(() => void tick(), 2000); void tick();
    window.addEventListener('online', tick); window.addEventListener('swish-rapid-change', tick);
    return () => { mounted = false; clearInterval(interval); window.removeEventListener('online', tick); window.removeEventListener('swish-rapid-change', tick); };
  }, [userId, tenantId, enabled, queries]);
}
