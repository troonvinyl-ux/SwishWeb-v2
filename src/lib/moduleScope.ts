import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModuleScope } from '@/types/ebaySync';

/** Native moduleAccessService contract; never derive authorization from storage or email. */
export async function verifyModuleScope(client: SupabaseClient, userId: string, tenantId: string, nicheId: string): Promise<ModuleScope> {
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== userId) throw new Error('Your sign-in changed. Reopen your SWISH workspace before continuing.');
  const current = await client.rpc('swish_current_module');
  if (current.error) throw new Error('Module authorization is unavailable. Refresh access before retrying.');
  const scope = current.data as ModuleScope | null;
  if (!scope || scope.tenant_id !== tenantId || scope.niche_id !== nicheId) throw new Error('The active module changed or is not authorized. Reopen this specialist workspace before syncing.');
  return scope;
}

/** One activation request, with server readback. No retries or cached authorization grants. */
export async function activateModuleScope(client: SupabaseClient, userId: string, tenantId: string, nicheId: string): Promise<ModuleScope> {
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== userId) throw new Error('Sign in to SWISH before opening a specialist workspace.');
  const current = await client.rpc('swish_current_module');
  if (current.error) throw new Error('Module authorization is unavailable. Refresh access before retrying.');
  if (current.data?.tenant_id !== tenantId || current.data?.niche_id !== nicheId) {
    const opened = await client.rpc('swish_open_module', { p_tenant_id: tenantId, p_niche_id: nicheId });
    if (opened.error) throw new Error(opened.error.message);
    if (opened.data !== true) throw new Error('Module selection was not confirmed. Refresh your memberships and retry.');
  }
  return verifyModuleScope(client, userId, tenantId, nicheId);
}
