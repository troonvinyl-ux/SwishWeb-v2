import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModuleScope } from '@/types/ebaySync';
import { backendRead, backendDataScope, shareBackendRequest } from '@/lib/backendRequests';
let activationTail: Promise<unknown> = Promise.resolve();
const currentModule = (client: SupabaseClient) => backendRead(client, 'current-module', signal => client.rpc('swish_current_module').abortSignal(signal), 'access');
/** Server readback, not a browser entitlement grant. */
export async function verifyModuleScope(client: SupabaseClient, userId: string, tenantId: string, nicheId: string): Promise<ModuleScope> {
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== userId) throw new Error('Your sign-in changed. Reopen your SWISH workspace before continuing.');
  const current = await currentModule(client);
  if (current.error) throw new Error('Module authorization is unavailable. Refresh access before retrying.');
  const scope = current.data as ModuleScope | null;
  if (!scope || scope.tenant_id !== tenantId || scope.niche_id !== nicheId) throw new Error('The active module changed or is not authorized. Reopen this specialist workspace before syncing.');
  return scope;
}
/** Serialize activations; share only pending work and never replay the open-module mutation. */
export async function activateModuleScope(client: SupabaseClient, userId: string, tenantId: string, nicheId: string): Promise<ModuleScope> {
  const identity = await backendDataScope(client);
  return shareBackendRequest(client, `activate:${userId}:${tenantId}:${nicheId}`, () => {
    const operation = activationTail.catch(() => undefined).then(async () => {
      if (await backendDataScope(client) !== identity) throw new Error('Authenticated session changed before module activation.');
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== userId) throw new Error('Sign in to SWISH before opening a specialist workspace.');
      const current = await currentModule(client);
      if (current.error) throw new Error('Module authorization is unavailable. Refresh access before retrying.');
      if (current.data?.tenant_id !== tenantId || current.data?.niche_id !== nicheId) {
        if (await backendDataScope(client) !== identity) throw new Error('Authenticated session changed before module activation.');
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
        const opened = await Promise.resolve(client.rpc('swish_open_module', { p_tenant_id: tenantId, p_niche_id: nicheId }).abortSignal(controller.signal)).finally(() => clearTimeout(timer));
        if (opened.error) throw new Error(opened.error.message);
        if (opened.data !== true) throw new Error('Module selection was not confirmed. Refresh your memberships and retry.');
      }
      if (await backendDataScope(client) !== identity) throw new Error('Authenticated session changed during module activation.');
      return verifyModuleScope(client, userId, tenantId, nicheId);
    });
    activationTail = operation; return operation;
  });
}
