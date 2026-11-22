import type { SupabaseClient } from '@supabase/supabase-js';
import { activateModuleScope, verifyModuleScope } from '@/lib/moduleScope';
import { callEdgeFunction } from '@/lib/supabase';

export interface PriceRevisionResult { confirmed: boolean; unconfirmed: boolean; message: string; price: number | null }
/** Native SWISH's one-click price-only route: never sends title, photos, quantity
 * or another listing. No automatic retries for uncertain marketplace outcomes. */
export async function reviseSharedListingPrice(input: {
  client: SupabaseClient; userId: string; tenantId: string; nicheId: string;
  listingId: string; expectedExternalId: string; newPrice: number; expectedPrice: number;
}): Promise<PriceRevisionResult> {
  const fail = (message: string, unconfirmed = false): PriceRevisionResult =>
    ({ confirmed: false, unconfirmed, price: null, message });
  const { client, userId, tenantId, nicheId, listingId, expectedExternalId, newPrice, expectedPrice } = input;
  if (!userId || !tenantId || !nicheId || !listingId || !/^\d{6,20}$/.test(expectedExternalId) ||
      !Number.isFinite(newPrice) || newPrice <= 0 || !Number.isFinite(expectedPrice) || expectedPrice <= 0)
    return fail('A linked live eBay listing and two valid seller prices are required.');
  await activateModuleScope(client, userId, tenantId, nicheId);
  const outcome = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', {
    route: 'revise_price', tenantId, nicheId, listingId, newPrice, expectedPrice,
  }, client);
  if (outcome.error) {
    const body = outcome.error.body && typeof outcome.error.body === 'object'
      ? outcome.error.body as Record<string, unknown> : {};
    const uncertain = body.unconfirmed === true || body.accepted === true ||
      outcome.error.status === 0 || (outcome.error.status >= 500 && !Object.keys(body).length);
    return fail(outcome.error.message + (uncertain ? ' Check the live eBay price before attempting another revision.' : ''), uncertain);
  }
  const result = outcome.data;
  if (!result || result.success !== true || result.verified !== true ||
      !Number.isFinite(Number(result.price)) ||
      Math.round(Number(result.price) * 100) !== Math.round(newPrice * 100) ||
      String(result.externalListingId ?? '') !== expectedExternalId)
    return fail(String(result?.error || 'The new eBay seller price was not verified. Check the live listing before retrying.'), true);
  // A confirmed provider price must also be saved to this exact tenant-owned row.
  const { data: saved, error } = await client.from('listings')
    .select('id,item_id,external_listing_id,price,status').eq('id', listingId)
    .eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').maybeSingle();
  if (error || !saved || saved.external_listing_id !== expectedExternalId ||
      Math.round(Number(saved.price) * 100) !== Math.round(newPrice * 100))
    return fail('eBay confirmed the price, but SWISH inventory readback is not yet confirmed. Refresh and inspect the listing before retrying.', true);
  await verifyModuleScope(client, userId, tenantId, nicheId);
  return { confirmed: true, unconfirmed: false, price: Number(saved.price), message: 'New seller price confirmed on eBay and saved in SWISH.' };
}
