import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { isStudioSessionCurrent, STUDIO_SESSION_TTL } from '@/lib/listingStudioSession';
import type { StudioSession } from '@/types/listingStudio';
interface StudioContextValue { session: StudioSession | null; retain: (session: StudioSession) => void; clear: () => void; }
const Context = createContext<StudioContextValue | null>(null);
/** Memory-only, account/tenant-bound camera recovery. Never an inventory or catalogue cache. */
export function ListingStudioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(), { tenantId } = useCurrentTenantId();
  const [stored, setStored] = useState<StudioSession | null>(null);
  const session = isStudioSessionCurrent(stored, user?.id || '', tenantId || '') ? stored : null;
  useEffect(() => { setStored(previous => isStudioSessionCurrent(previous, user?.id || '', tenantId || '') ? previous : null); }, [user?.id, tenantId]);
  useEffect(() => { if (!stored) return; const timer = setTimeout(() => setStored(null), Math.max(0, stored.updatedAt + STUDIO_SESSION_TTL - Date.now())); return () => clearTimeout(timer); }, [stored]);
  const retain = useCallback((value: StudioSession) => { if (isStudioSessionCurrent(value, user?.id || '', tenantId || '')) setStored(value); }, [user?.id, tenantId]);
  const clear = useCallback(() => setStored(null), []);
  return <Context.Provider value={{ session, retain, clear }}><Fragment key={`${user?.id}:${tenantId}`}>{children}</Fragment></Context.Provider>;
}
export function useListingStudioSession() { const value = useContext(Context); if (!value) throw new Error('Listing Studio requires its scoped session provider.'); return value; }
