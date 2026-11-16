import { useState } from 'react';
import { useEbaySync } from '@/hooks/useEbaySync';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunction, EdgeFunctionError, getSupabaseClient } from '@/lib/supabase';
import { beginEbayOAuth, clearEbayOAuth } from '@/lib/ebayOAuthPending';
import { useEbayOAuthRecovery } from '@/hooks/useEbayOAuthRecovery';
import { toast } from 'sonner';

export function useEbayHubActions(tenantId: string | null) {
  const { user } = useAuth();
  const { sync, syncing, syncError, syncProgress } = useEbaySync(tenantId);
  const { waiting, setWaiting } = useEbayOAuthRecovery(tenantId);
  const [opening, setOpening] = useState(false);

  const connect = async () => {
    if (opening || waiting) return;
    setOpening(true);
    try {
      const sb = getSupabaseClient();
      if (!sb || !user || !tenantId) throw new Error('Your SWISH workspace is not ready. Complete setup before connecting eBay.');
      const { data, error } = await callEdgeFunction<Record<string, unknown>>('swish-ebay-oauth', { action: 'start_subscriber_authorization', tenantId }, sb);
      if (error) throw error;
      const url = data?.consentUrl;
      if (typeof url !== 'string' || !url.startsWith('https://auth.ebay.com/')) throw new Error('The existing eBay service did not return a valid consent URL.');
      beginEbayOAuth(user.id, tenantId);
      setWaiting(true);
      // External navigation only. Internal navigation uses React Router.
      window.open(url, '_self');
    } catch (error) {
      if (user?.id && tenantId) clearEbayOAuth(user.id, tenantId);
      setWaiting(false);
      toast.error(error instanceof EdgeFunctionError ? error.displayMessage : error instanceof Error ? error.message : 'Could not start eBay connection');
    } finally { setOpening(false); }
  };
  return { connect, sync, connecting: opening || waiting, syncing, syncError, syncProgress };
}
