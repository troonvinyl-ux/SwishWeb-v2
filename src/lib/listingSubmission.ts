import type { SupabaseClient } from '@supabase/supabase-js';
import { publicationBlock } from '@/lib/listingReadiness';
import { NICHE_SPECIALISTS, getActiveNicheId, type SwishNicheId } from '@/lib/niche';

export function listingNicheId(item: Record<string, unknown>): SwishNicheId {
  return (Object.entries(NICHE_SPECIALISTS).find(([, specialists]) => specialists.includes(String(item.specialist_id)))?.[0] as SwishNicheId | undefined) || getActiveNicheId();
}

export async function readSubmissionListing(client: SupabaseClient, tenantId: string, listingId: string): Promise<Record<string, unknown>> {
  const result = await client.from('listings').select('*').eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').single();
  if (result.error || !result.data) throw new Error(result.error?.message || 'The saved listing is unavailable.');
  return result.data as Record<string, unknown>;
}

/** Restore an unpublished review/verified draft on an explicit submit action.
 * The native claim RPC accepts draft/pending/failed, not review/verified. Claims and
 * external IDs are server-owned and are never cleared, expired or overwritten. */
export async function prepareSharedSubmission(client: SupabaseClient, tenantId: string, listingId: string): Promise<Record<string, unknown>> {
  const row = await readSubmissionListing(client, tenantId, listingId);
  const blocked = publicationBlock(row);
  if (blocked) throw new Error(blocked);
  const status = String(row.status || '').toLowerCase();
  if (row.publish_claim_id || !['verified', 'review', 'review_required'].includes(status)) return row;
  let update = client.from('listings').update({ status: 'draft' }).eq('id', listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').eq('status', row.status).is('publish_claim_id', null);
  update = row.external_listing_id === null || row.external_listing_id === undefined ? update.is('external_listing_id', null) : update.eq('external_listing_id', '');
  if (row.updated_at) update = update.eq('updated_at', row.updated_at);
  const result = await update.select('*').maybeSingle();
  if (result.error) throw new Error(result.error.message);
  // A concurrent submission wins; reread rather than replacing its claim.
  const fresh = result.data as Record<string, unknown> | null || await readSubmissionListing(client, tenantId, listingId);
  if (publicationBlock(fresh)) throw new Error(publicationBlock(fresh)!);
  return fresh;
}
