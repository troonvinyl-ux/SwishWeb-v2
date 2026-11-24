import { useEffect, useRef } from 'react';
import { useListingStudioSession } from '@/contexts/ListingStudioContext';
import type { StudioSession } from '@/types/listingStudio';
import type { SwishNicheId } from '@/lib/niche';
/** Delivers originals once to an existing workflow, never re-creates canonical items. */
export function useStudioHandoff(niche: SwishNicheId | null, receive: (session: StudioSession) => void) {
  const { session, clear } = useListingStudioSession(), callback = useRef(receive), delivered = useRef<StudioSession | null>(null); callback.current = receive;
  // React effect replay must not prepare the same retained item twice.
  useEffect(() => { if (!session?.handedOff || !niche || session.niche !== niche || delivered.current === session) return; delivered.current = session; callback.current(session); clear(); }, [session, niche, clear]);
}
