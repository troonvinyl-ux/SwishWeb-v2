import { assertCaptureScope, captureRecord, captureRequest, captureText } from '@/lib/captureRequest';
import { getSpecialistIdsForNiche } from '@/lib/niche';
import { parseNumistaNumber } from '@/lib/numistaCapture';
import { unattributedCoinCopy } from '@/lib/listingEvidence';
import type { CaptureScope } from '@/types/capture';

type CoinDraftReadiness = { ready: true; typeId: number | null } | { ready: false; message: string };

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const positive = (value: unknown): boolean => Number.isFinite(Number(value)) && Number(value) > 0;

/**
 * Coin listings use the existing shared draft path, but only after the saved
 * inventory record proves both original faces and seller measurements.
 * A Numista reference is optional but malformed or conflicting saved references
 * cannot be silently turned into a catalogue attribution.
 */
export function coinItemDraftReadiness(item: Record<string, unknown>): CoinDraftReadiness {
  const attributes = record(item.attributes), scan = record(attributes.source_scan), metadata = record(scan.scan_metadata), images = record(scan.scan_images);
  const typeId = [attributes.numista_type_id, attributes.numista_number, attributes.numista_n, attributes.numista_reference, attributes.reference_url, metadata.numista_number, metadata.numista_reference, metadata.reference_url]
    .map(parseNumistaNumber).find((value): value is number => Boolean(value));
  const supplied = attributes.numista_number ?? attributes.numista_n ?? attributes.numista_type_id ?? metadata.numista_number;
  if (supplied && !typeId) return { ready: false, message: 'The saved Numista reference is invalid. Correct it or clear it for an unattributed draft.' };
  const permanentPhotos = [item.image_url, ...(Array.isArray(item.media) ? item.media : [])].filter(value => typeof value === 'string' && value.trim());
  if ((!images.obverse || !images.reverse) && permanentPhotos.length < 2) return { ready: false, message: 'This saved coin is missing its obverse or reverse evidence. Reopen it and save both original faces before pulling a draft.' };
  const weight = item.weight_grams ?? attributes.supplied_weight_g ?? metadata.weight;
  if (!positive(weight)) return { ready: false, message: 'This saved coin has no valid actual weight. Reopen it and record the measured grams before pulling a draft.' };
  const dimensions = record(item.dimensions_mm);
  const diameter = dimensions.diameter ?? attributes.supplied_diameter_mm ?? metadata.diameter;
  if (!positive(diameter)) return { ready: false, message: 'This saved coin has no valid actual diameter. Reopen it and record the measured millimetres before pulling a draft.' };
  return { ready: true, typeId };
}

/** Reuses swish-list-generate and swish_create_listing_draft; it never publishes. */
export async function createCoinListingDraft(scope: CaptureScope, itemId: string): Promise<{ listingId: string; reused: boolean }> {
  await assertCaptureScope(scope);
  const stock = await scope.client.from('items').select('id,tenant_id,specialist_id,status,media,weight_grams,dimensions_mm,catalogue_number,attributes').eq('id', itemId).eq('tenant_id', scope.tenantId).single();
  if (stock.error || !stock.data) throw new Error(stock.error?.message || 'Saved coin could not be found in this workspace.');
  if (!getSpecialistIdsForNiche('coins').includes(String(stock.data.specialist_id))) throw new Error('The saved inventory item is not a coin. Open its own listing workspace.');
  const evidence = coinItemDraftReadiness(stock.data as Record<string, unknown>);
  if ('message' in evidence) throw new Error(evidence.message);

  const existing = await scope.client.from('listings').select('id,status,external_listing_id,publish_claim_id').eq('tenant_id', scope.tenantId).eq('item_id', itemId).eq('marketplace_id', 'ebay').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if (existing.data.external_listing_id || existing.data.publish_claim_id || !['draft', 'review', 'review_required'].includes(String(existing.data.status))) throw new Error('This coin already has a marketplace submission. Open that listing instead of pulling another draft.');
    return { listingId: String(existing.data.id), reused: true };
  }

  const response = await captureRequest(scope, 'swish-list-generate', { item_id: itemId, tenant_id: scope.tenantId, marketplace_id: 'ebay' });
  const generated = captureRecord(response.listing);
  if (!captureText(generated.title)) throw new Error('The shared listing engine returned no coin draft. Your inventory item remains saved; retry this same item later.');
  const attributes=record(stock.data.attributes),dimensions=record(stock.data.dimensions_mm);
  const physicalCopy=!evidence.typeId?unattributedCoinCopy(stock.data.weight_grams??attributes.supplied_weight_g,dimensions.diameter??attributes.supplied_diameter_mm):null;
  const draftCopy=physicalCopy?{...generated,...physicalCopy}:generated;
  await assertCaptureScope(scope);
  const saved = await scope.client.rpc('swish_create_listing_draft', { p_tenant_id: scope.tenantId, p_item_id: itemId, p_marketplace_id: 'ebay', p_listing: draftCopy, p_shipping_cost: 0, p_category_id: null });
  if (saved.error || typeof saved.data !== 'string' || !saved.data) throw new Error(saved.error?.message || 'Coin draft creation was not confirmed. Inspect this item before retrying.');
  await assertCaptureScope(scope);
  const verified = await scope.client.from('listings').select('id,item_id,tenant_id,status,external_listing_id,publish_claim_id').eq('id', saved.data).eq('tenant_id', scope.tenantId).single();
  if (verified.error || !verified.data || String(verified.data.item_id) !== itemId) throw new Error('Coin draft saved, but readback failed. Inspect the saved item; no eBay publication was requested.');
  if (verified.data.external_listing_id || verified.data.publish_claim_id) throw new Error('This coin listing already has a marketplace submission. Inspect it instead of publishing again.');
  return { listingId: String(verified.data.id), reused: false };
}
