import { asRecord } from '@/lib/itemPhotos';
import { ebayConditionId, EBAY_MUSIC_CONDITIONS } from '@/lib/ebayMusicContract';
export interface ListingEditorSaveResult { listing: Record<string, unknown>; item: Record<string, unknown>; }
export interface ConfirmedMusicDetails { media_grade?: string; sleeve_grade?: string; play_tested?: boolean; condition_notes?: string; }
/** The native editor RPC stores specifics as [{name,value}]; older scans store a map. */
export function listingSpecifics(value: unknown): Record<string, string> {
  const entries = Array.isArray(value) ? value.map(entry => { const row = asRecord(entry); return [String(row.name || ''), String(row.value || '')]; }) : Object.entries(asRecord(value)).map(([key, entry]) => [key, String(entry ?? '')]);
  return Object.fromEntries(entries.filter(([key, entry]) => key.trim() && entry.trim()).map(([key, entry]) => [key.trim(), entry.trim()]));
}
const present = (...values: unknown[]) => values.find(value => value !== null && value !== undefined && value !== '') ?? '';
/** Hydrate only with matching stock; keep the eBay item condition distinct from music grading. */
export function hydrateListingEditor(listing: Record<string, unknown>, stock: Record<string, unknown>): Record<string, unknown> {
  const attrs = asRecord(stock.attributes), options = asRecord(attrs.ebay_listing_options);
  // An explicit empty saved condition ID means the category was changed and
  // its new eBay-valid condition has not been selected yet. Do not synthesize
  // Used/3000 from stock text and make the unfinished draft look publishable.
  const conditionId = Object.prototype.hasOwnProperty.call(attrs, 'ebay_condition_id')
    ? String(attrs.ebay_condition_id ?? '')
    : String(present(stock.ebay_condition_id, listing.condition_id, ebayConditionId(stock.condition)));
  const condition = stock.specialist_id === 'vinyl_records' ? EBAY_MUSIC_CONDITIONS.find(row => row.id === conditionId)?.label || (/^Media\s/i.test(String(stock.condition || '')) ? '' : present(stock.condition, listing.condition)) : present(stock.condition, listing.condition);
  return { ...listing, category_id: present(listing.category_id, attrs.ebay_category_id, stock.ebay_category_id), category: present(attrs.ebay_category_name, stock.ebay_category_name, listing.category), condition, condition_id: conditionId, condition_description: present(stock.condition_notes, stock.condition_grade, attrs.condition_notes, listing.condition_description), item_specifics: listingSpecifics(attrs.ebay_item_specifics), quantity: present(stock.quantity, attrs.quantity, 1), sku: present(stock.sku, attrs.sku), listing_type: options.listingType || 'FixedPriceItem', auction_duration: options.auctionDays || 7, start_price: options.startPrice || '', reserve_price: options.reservePrice || '', best_offer_enabled: options.bestOfferEnabled === true, dispatch_days: options.dispatchDays || 3 };
}
