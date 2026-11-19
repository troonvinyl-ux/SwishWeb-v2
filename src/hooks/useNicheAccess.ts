import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { loadVerifiedNicheAccess } from '@/lib/nicheAccess';
import type { SwishNicheId } from '@/lib/niche';

const NO_NICHES: SwishNicheId[] = [];

/** One account/workspace-scoped membership snapshot for selector, dashboard and capture. */
export function useNicheAccess() {
  const { user } = useAuth();
  const tenant = useCurrentTenantId();
  const query = useQuery({
    queryKey: ['verified_niche_access', user?.id, tenant.tenantId],
    enabled: Boolean(user?.id && tenant.tenantId),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async ({ signal }) => {
      const client = await getSupabaseClientAsync();
      if (!client || !user?.id || !tenant.tenantId) throw new Error('Your SWISH account is not ready.');
      return loadVerifiedNicheAccess(client, user.id, tenant.tenantId, signal);
    },
  });
  const error = tenant.error || query.error;
  return {
    nicheIds: error ? NO_NICHES : query.data?.nicheIds ?? NO_NICHES,
    isOwner: !error && query.data?.owner === true,
    isLoading: tenant.isLoading || Boolean(user?.id && tenant.tenantId && (query.isPending || query.isFetching)),
    error,
    refetch: () => tenant.tenantId ? query.refetch() : tenant.refetch(),
  };
}
