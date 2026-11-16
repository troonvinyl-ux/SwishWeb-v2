import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import { normaliseNicheId } from '@/lib/niche';
import { runEbaySyncBatches } from '@/lib/ebaySyncBatches';
import type { EbayBatchResponse, EbaySyncOptions, EbaySyncResult } from '@/types/ebaySync';

const activeSyncs = new Map<string, Promise<EbaySyncResult>>();
/** Each existing Edge request has the app's 105-second wait bound, without mutation retries. */
async function invokeSyncBatch(client: SupabaseClient, userId: string, tenantId: string, nicheId: string, body: Record<string, unknown>): Promise<EbayBatchResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await verifyModuleScope(client, userId, tenantId, nicheId);
    const session = await client.auth.getSession();
    const active = session.data.session;
    if (session.error || !active || active.user.id !== userId) throw new Error('Your sign-in changed before sync dispatch.');
    const token = active.access_token;
    const invocation = callEdgeFunction<Record<string, unknown>>('swish-ebay-sync', body, client, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Sync timed out. Existing records are retained; refresh saved status before retrying.')); }, 105000); });
    const response = await Promise.race([invocation, timeout]);
    if (timer) clearTimeout(timer);
    await verifyModuleScope(client, userId, tenantId, nicheId);
    const payload = response.data || (response.error?.body && typeof response.error.body === 'object' && !Array.isArray(response.error.body) ? response.error.body as Record<string, unknown> : null);
    return { data: payload, error: response.error?.displayMessage || (payload?.success === true ? null : typeof payload?.error === 'string' ? payload.error : 'eBay operation was not confirmed. Refresh saved status before retrying.'), requiresReauth: payload?.requiresReauth === true };
  } catch (cause) {
    return { data: null, error: cause instanceof Error ? cause.message : 'Sync unavailable. Existing inventory is preserved.', requiresReauth: false };
  } finally { if (timer) clearTimeout(timer); }
}

export function runNicheEbaySync(client: SupabaseClient, userId: string, tenantId: string, nicheId: string, options: EbaySyncOptions = {}): Promise<EbaySyncResult> {
  const niche = normaliseNicheId(nicheId);
  if (!userId || !tenantId || !niche) return Promise.resolve({ data: null, error: 'Open a verified specialist workspace before syncing.', requiresReauth: false });
  const key = `${userId}:${tenantId}:${niche}`;
  const running = activeSyncs.get(key);
  if (running) return running;
  const request = runEbaySyncBatches({ ...options, tenantId, nicheId: niche, invoke: body => invokeSyncBatch(client, userId, tenantId, niche, body) }).finally(() => activeSyncs.delete(key));
  activeSyncs.set(key, request);
  return request;
}
