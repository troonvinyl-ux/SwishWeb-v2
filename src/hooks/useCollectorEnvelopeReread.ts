import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { loadCaptureProfile } from '@/lib/nativeCaptureProfiles';
import { readCollectorEnvelope } from '@/lib/readCollectorEnvelope';
import { persistCollectorEnvelope } from '@/lib/persistCollectorEnvelope';
import type { RapidCoinJob } from '@/types/rapidCoin';
export function useCollectorEnvelopeReread(job: RapidCoinJob) {
  const { user } = useAuth(), tenant = useCurrentTenantId();
  const identity = useRef(''), flight = useRef(false);
  identity.current = `${user?.id || ''}:${tenant.tenantId || ''}`;
  const [busy, setBusy] = useState(false);
  const reread = async () => {
    if (flight.current) return;
    if (identity.current !== job.scope || job.processing === 'processing' || job.lease || job.publication !== 'none' || job.publicationAttempt || job.externalId) { toast.error('Wait for this same coin to finish processing, or inspect its existing publication.'); return; }
    flight.current = true; setBusy(true);
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('The SWISH backend is unavailable. Your envelope remains saved.');
      const scope = { client, userId: job.userId, tenantId: job.tenantId, nicheId: 'coins' as const, sessionId: job.id, isCurrent: () => identity.current === job.scope && getActiveNicheId() === 'coins' };
      const profile = await loadCaptureProfile('coins', 'coins'), mode = profile.modes[0]?.id;
      if (!mode) throw new Error('The shared coin capture mode is unavailable.');
      const read = await readCollectorEnvelope(scope, job, mode);
      await persistCollectorEnvelope(scope, job, read);
      toast.success('Envelope read and retained on this coin. Review its collector-labelled identity; use Check saved draft / resume if preparation was rejected.');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'The envelope read did not finish. Its original is retained.'); }
    finally { flight.current = false; setBusy(false); }
  };
  return { busy, reread };
}
