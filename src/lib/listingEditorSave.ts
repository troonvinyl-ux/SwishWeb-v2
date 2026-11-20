import type { SupabaseClient } from '@supabase/supabase-js';
import { activateModuleScope } from '@/lib/moduleScope';
import { getActiveNicheId } from '@/lib/niche';
import { availableItemPhotos, itemPhotos, asRecord } from '@/lib/itemPhotos';
import { permanentListingPhoto, publicationBlock } from '@/lib/listingReadiness';
import { listingSpecifics, type ConfirmedMusicDetails, type ListingEditorSaveResult } from '@/lib/listingEditorData';
import { retainListingEditorMetadata } from '@/lib/listingEditorMetadata';
interface EditorSaveInput { client: SupabaseClient; userId: string; tenantId: string; form: Record<string, unknown>; item: Record<string, unknown>; photos: string[]; uploads: string[]; confirmedMusic?: ConfirmedMusicDetails; }
/** Native listingEditorService's atomic RPC, not web-only listings columns. */
export async function saveSharedListingEditor({ client, userId, tenantId, form, item, photos, uploads, confirmedMusic }: EditorSaveInput): Promise<ListingEditorSaveResult> {
  if (!form.id || form.tenant_id !== tenantId || item.tenant_id !== tenantId || item.id !== form.item_id) throw new Error('Open a saved listing and its stock item in this workspace.');
  if (publicationBlock(form)) throw new Error('Inspect the existing submission before editing this draft.');
  const title = String(form.title || '').trim(), price = Number(form.price), quantity = Number(form.quantity || 1);
  if (title.length < 10 || title.length > 80 || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) throw new Error('Use a 10–80 character title, a positive selling price and a whole quantity.');
  const shipping = Number(form.shipping_cost || 0), floor = Number(form.floor_price || 0), ceiling = Number(form.ceiling_price || 0);
  if ([shipping, floor, ceiling].some(value => !Number.isFinite(value) || value < 0)) throw new Error('Enter valid non-negative shipping and price limits.');
  const allowed = new Set([...availableItemPhotos(item), ...uploads]);
  if (!photos.length || photos.length > 12 || photos.some(url => !permanentListingPhoto(url) || !allowed.has(url))) throw new Error('Select 1–12 saved item photos. Uploaded photos will be attached to this same item.');
  await activateModuleScope(client, userId, tenantId, getActiveNicheId());
  const attrs = asRecord(item.attributes);
  const music = confirmedMusic || {};
  if (Object.keys(music).length && item.specialist_id !== 'vinyl_records') throw new Error('Music corrections require the original Tunes Flip stock item.');
  const specificsMap = listingSpecifics(attrs.ebay_item_specifics);
  for (const key of ['media_grade', 'sleeve_grade'] as const) if (music[key]) {
    if (!/^(M|NM|VG\+|VG|G\+|G|F|P)$/.test(music[key]!)) throw new Error('Choose a supported media or sleeve grade.');
    specificsMap[key === 'media_grade' ? 'Record Grading' : 'Sleeve Grading'] = music[key]!;
  }
  const specifics = Object.entries(specificsMap).map(([name, value]) => ({ name: name.trim(), value: String(value).trim() })).filter(value => value.name && value.value);
  if (specifics.length > 25 || new Set(specifics.map(value => value.name.toLowerCase())).size !== specifics.length || specifics.some(value => value.name.length > 65 || value.value.length > 65)) throw new Error('eBay specifics must be unique and no more than 65 characters per name/value. Edit the music specifics; no value was truncated.');
  const conditionNotes = String(form.condition_description ?? item.condition_notes ?? item.condition_grade ?? '');
  if (conditionNotes.length > 1000) throw new Error('Keep eBay condition notes to 1,000 characters.');
  const listingOptions = { listingType: form.listing_type === 'Chinese' ? 'Chinese' : 'FixedPriceItem', auctionDays: Number(form.auction_duration || 7), startPrice: String(form.start_price || price), reservePrice: String(form.reserve_price || ''), bestOfferEnabled: form.best_offer_enabled === true, dispatchDays: Number(form.dispatch_days || 3) };
  const response = await client.rpc('swish_save_listing_editor', {
    p_tenant_id: tenantId, p_listing_id: String(form.id),
    p_listing_patch: { title, description: String(form.description || ''), price, shipping_cost: shipping, floor_price: floor, ceiling_price: ceiling, category_id: form.category_id || null },
    p_item_patch: { condition: String(form.condition || item.condition || ''), condition_grade: conditionNotes, condition_notes: conditionNotes, quantity, sku: String(form.sku || item.sku || ''), ebay_category_id: String(form.category_id || ''), ebay_category_name: String(form.category || attrs.ebay_category_name || ''), ebay_condition_id: String(form.condition_id || ''), ebay_listing_media: photos, ebay_listing_options: listingOptions },
    p_specifics: specifics,
  });
  if (response.error) throw new Error(response.error.message);
  if (!response.data) throw new Error('SWISH did not confirm the editor save. Reopen this saved draft; it was not published.');
  const [read, current] = await Promise.all([
    client.from('listings').select('*').eq('id', form.id).eq('tenant_id', tenantId).single(),
    client.from('items').select('*').eq('id', item.id).eq('tenant_id', tenantId).single(),
  ]);
  if (read.error || !read.data || current.error || !current.data) throw new Error(read.error?.message || current.error?.message || 'Save completed but readback is unavailable. Your edits remain on screen.');
  if (String(read.data.category_id || '') !== String(form.category_id || '') || String(current.data.condition || '') !== String(form.condition || item.condition || '') || String(current.data.condition_grade || '') !== conditionNotes || read.data.title !== title || read.data.description !== String(form.description || '')) throw new Error('SWISH did not retain all category, condition or text changes. Your edits remain on screen; do not publish this version.');
  const retained = await retainListingEditorMetadata({ client, item: current.data, form, photos, uploads, options: listingOptions, confirmedMusic });
  const retainedAttrs = asRecord(retained.attributes);
  if (String(retainedAttrs.ebay_category_name || '') !== String(form.category || '') || String(retainedAttrs.ebay_condition_id || '') !== String(form.condition_id || '') || String(retained.condition_notes || '') !== conditionNotes) throw new Error('Category or condition readback differs. Your edits remain on screen; retry the same draft.');
  console.log('[SWISH Editor] Category and condition readback confirmed');
  return { listing: read.data, item: retained };
}
