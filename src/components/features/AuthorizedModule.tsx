import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import type { SwishNicheId } from '@/lib/niche';

interface AuthorizedModuleProps { nicheId: SwishNicheId; children: ReactNode; enabled?: boolean; }
export default function AuthorizedModule({ nicheId, children, enabled = true }: AuthorizedModuleProps) {
  const { user } = useAuth();
  const tenant = useCurrentTenantId();
  const location = useLocation();
  // Native capture aliases redirect before choosing a module; authorize the destination.
  const mustAuthorize = enabled && !['/capture', '/identify', '/antique-capture', '/tools/bike-flipper'].includes(location.pathname);
  const access = useQuery({
    queryKey: ['authorized_module', user?.id, tenant.tenantId, nicheId],
    enabled: mustAuthorize && Boolean(user && tenant.tenantId), retry: false, staleTime: 0, gcTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async () => {
      const client = await getSupabaseClientAsync();
      if (!client || !user || !tenant.tenantId) throw new Error('Your SWISH account is not ready. Complete setup before opening a module.');
      return activateModuleScope(client, user.id, tenant.tenantId, nicheId);
    },
  });
  if (!mustAuthorize) return <>{children}</>;
  const error = tenant.error || access.error;
  if (error || (!tenant.isLoading && !tenant.tenantId)) return <section role="alert" className="swish-card max-w-2xl space-y-4 p-6">
    <h1 className="flex items-center gap-3 text-xl font-semibold"><AlertCircle className="h-6 w-6 text-destructive" />Specialist access needs verification</h1>
    <p className="leading-7 text-muted-foreground">{error?.message || 'No existing SWISH workspace was found. Complete your account setup.'} No new eBay operation was sent.</p>
    <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary min-h-11 disabled:opacity-50" disabled={!tenant.tenantId || access.isFetching} onClick={() => void access.refetch()}>Retry access check</button><Link to="/niches" className="btn-secondary min-h-11">Choose a module</Link><Link to="/onboarding" className="btn-secondary min-h-11">Account setup</Link></div>
  </section>;
  if (tenant.isLoading || access.isPending || access.isFetching) return <div role="status" className="swish-card flex items-center gap-3 p-6"><ShieldCheck className="h-6 w-6 text-primary" /><p className="text-muted-foreground">Verifying your SWISH specialist workspace…</p></div>;
  return <>{children}</>;
}
