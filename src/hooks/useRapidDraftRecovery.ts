import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { recoverRapidDraft } from '@/lib/rapidDraftRecovery';
import type { RapidCoinJob } from '@/types/rapidCoin';
export function useRapidDraftRecovery(job: RapidCoinJob) {
  const { user } = useAuth(), tenant = useCurrentTenantId();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const identityRef = useRef(''), flightRef = useRef(false);
  identityRef.current = `${user?.id || ''}:${tenant.tenantId || ''}`;
  const check = async () => {
    if (flightRef.current || user?.id !== job.userId || tenant.tenantId !== job.tenantId || getActiveNicheId() !== 'coins') { toast.error('Open this coin in its original seller workspace.'); return; }
    flightRef.current = true; setBusy(true); setMessage('');
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH backend is unavailable. Your original capture is retained.');
      const result = await recoverRapidDraft({ client, userId: job.userId, tenantId: job.tenantId, nicheId: 'coins', sessionId: job.id, isCurrent: () => getActiveNicheId() === 'coins' && identityRef.current === job.scope }, job);
      setMessage(result.message);
      if (result.resumed) toast.success(result.message); else toast.info(result.message);
    } catch (cause) { const detail = cause instanceof Error ? cause.message : 'The original draft could not be checked. Nothing was recreated.'; setMessage(detail); toast.error(detail); }
    finally { flightRef.current = false; setBusy(false); }
  };
  return { busy, message, check };
}
