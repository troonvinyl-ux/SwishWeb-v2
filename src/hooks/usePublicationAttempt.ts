import { useState } from 'react';
import { confirmedPublicationRejection, readPublicationReservation, rejectedAttemptCanRetry, type PublicationReply, type PublicationReservation } from '@/lib/publicationRecovery';
export function usePublicationAttempt(userId: string | undefined, tenantId: string | null, listingId: string) {
  const key = `swish-publication:${userId}:${tenantId}:${listingId}`;
  const [memory, setMemory] = useState<{ key: string; value: PublicationReservation | null } | null>(null);
  const read = () => readPublicationReservation(sessionStorage.getItem(key)) || (memory?.key === key ? memory.value : null);
  const reservation = read();
  const store = (value: PublicationReservation) => { sessionStorage.setItem(key, JSON.stringify(value)); setMemory({ key, value }); };
  return { attempted: Boolean(reservation), outcome: reservation?.outcome, detail: reservation?.detail,
    reserve: async () => {
      if (!userId || !tenantId || !listingId) throw new Error('Open a saved listing in your workspace.');
      if (read()) throw new Error('A previous submission needs inspection. Check eBay and the saved listing status.');
      store({ version: 2, outcome: 'pending' });
    },
    settle: (reply: PublicationReply, published: boolean, detail: string) => store({ version: 2, outcome: published ? 'published' : confirmedPublicationRejection(reply) ? 'rejected' : 'uncertain', detail }),
    reconcileRejected: (listing: Record<string, unknown>) => {
      if (!tenantId || !rejectedAttemptCanRetry(read(), listing, tenantId, listingId)) return false;
      // Clear only a confirmed rejection after fresh scoped server readback. Never clear a pending server claim.
      sessionStorage.removeItem(key); setMemory({ key, value: null }); return true;
    },
  };
}
