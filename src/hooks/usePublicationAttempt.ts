import { useState } from 'react';
export function usePublicationAttempt(userId: string | undefined, tenantId: string | null, listingId: string) {
  const key = `swish-publication:${userId}:${tenantId}:${listingId}`;
  const [attempted, setAttempted] = useState(() => Boolean(sessionStorage.getItem(key)));
  return { attempted, reserve: async () => {
    if (!userId || !tenantId || !listingId) throw new Error('Open a saved listing in your workspace.');
    if (sessionStorage.getItem(key)) throw new Error('A previous submission needs inspection. Check eBay and the saved listing status.');
    sessionStorage.setItem(key, new Date().toISOString()); setAttempted(true);
  } };
}
