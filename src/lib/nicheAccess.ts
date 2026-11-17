import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { parseNicheEntitlements, type VerifiedNicheAccess } from '@/lib/nicheEntitlements';

/** Mirrors native moduleAccessService. Specialist configuration is not a membership grant. */
export async function loadVerifiedNicheAccess(client: SupabaseClient, userId: string, tenantId: string, signal?: AbortSignal): Promise<VerifiedNicheAccess> {
  if (!tenantId || !userId) throw new Error('Your SWISH account and workspace must be ready before checking access.');
  const assertAccount = async () => {
    const { data, error } = await client.auth.getSession();
    const session = data.session;
    if (error || !session || session.user.id !== userId || !session.access_token) {
      throw new Error('Your sign-in changed. Reopen the niche selector with your current SWISH account.');
    }
    return session.access_token;
  };
  const token = await assertAccount();
  const { data, error } = await callEdgeFunction<Record<string, unknown>>(
    'swish-check-subscription', { tenantId }, client,
    { signal, headers: { Authorization: `Bearer ${token}` } },
  );
  if (error) throw new Error(error.displayMessage);
  if (!data) throw new Error('SWISH returned no membership verification. Refresh access and retry.');
  let owner = data.is_platform_owner === true;
  // Older deployments omit the trusted role. Use the same backend RPC as native.
  if (typeof data.is_platform_owner !== 'boolean') {
    const result = await client.rpc('swish_is_platform_owner');
    if (result.error) throw new Error('SWISH platform-role verification is unavailable. Refresh access and retry.');
    owner = result.data === true;
  }
  await assertAccount();
  if (signal?.aborted) throw new Error('Membership verification was cancelled.');
  return parseNicheEntitlements(data, owner);
}
