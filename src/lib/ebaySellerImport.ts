import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { activateModuleScope, verifyModuleScope } from '@/lib/moduleScope';
import { getDefaultSpecialistForNiche, getSpecialistIdsForNiche, type SwishNicheId } from '@/lib/niche';

export interface SellerEbayListing {
  itemId: string;
  title: string;
  description?: string;
  price: number;
  ebayStatus: 'active' | 'sold' | 'ended';
  categoryId?: string;
  categoryName?: string;
  conditionId?: string;
  conditionDisplayName?: string;
  conditionDescription?: string;
  itemSpecifics?: Array<{ name: string; value: string }>;
  photos?: string[];
  quantity?: number;
  sku?: string;
  listedAt?: string;
  shippingCost?: number;
  watchCount?: number;
}
export interface ExistingStockMatch { id: string; title: string; status: string }
export interface SellerEbayCandidate {
  listing: SellerEbayListing;
  matches: ExistingStockMatch[];
}
export interface SellerDiscovery {
  candidates: SellerEbayCandidate[];
  existing: number;
  excludedForReview: number;
  ignoredNotActive: number;
  truncated: boolean;
}
const musicSpecific = /^(record grading|sleeve grading|cd grading|cassette condition|case condition|inlay condition|media grade|sleeve grade)$/i;
const value = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const titleKey = (v: unknown) => value(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const money = (v: unknown) => Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0;
export function validatedSellerListing(raw: unknown): SellerEbayListing | null {
  const item = record(raw), itemId = value(item.itemId), title = value(item.title);
  if (!/^\d{6,20}$/.test(itemId) || !title || item.ebayStatus !== 'active' || !Number.isFinite(Number(item.price)) || Number(item.price) < 0) return null;
  return {
    itemId, title: title.slice(0, 200), description: value(item.description).slice(0, 16000),
    price: Number(item.price), ebayStatus: 'active', categoryId: value(item.categoryId),
    categoryName: value(item.categoryName), conditionId: value(item.conditionId),
    conditionDisplayName: value(item.conditionDisplayName), conditionDescription: value(item.conditionDescription),
    itemSpecifics: Array.isArray(item.itemSpecifics) ? item.itemSpecifics.map(s => {
      const field = record(s); return { name: value(field.name).slice(0, 65), value: value(field.value).slice(0, 65) };
    }).filter(s => s.name && s.value).slice(0, 40) : [],
    photos: Array.isArray(item.photos) ? [...new Set(item.photos.map(value).filter(url => /^https:\/\/[^\s]+$/i.test(url)))].slice(0, 12) : [],
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)), sku: value(item.sku).slice(0, 100),
    listedAt: value(item.listedAt), shippingCost: money(item.shippingCost), watchCount: Math.max(0, Math.floor(Number(item.watchCount) || 0)),
  };
}
/** A seller-supplied price is an asking price, never invented market valuation. */
export function canonicalEbayImportPayload(candidate: SellerEbayListing, nicheId: SwishNicheId) {
  const music = nicheId === 'tunes_flip';
  const specifics = (candidate.itemSpecifics || []).filter(s => music || !musicSpecific.test(s.name));
  const attributes: Record<string, unknown> = {
    niche_id: nicheId,
    _ebay_item_id: candidate.itemId,
    _ebay_title: candidate.title,
    ebay_category_id: candidate.categoryId || '',
    ebay_category_name: candidate.categoryName || '',
    ebay_condition_id: candidate.conditionId || '',
    ebay_item_specifics: specifics,
    _ebay_img_count: candidate.photos?.length || 0,
  };
  if (music) {
    const grade = (name: string) => specifics.find(s => s.name.toLowerCase() === name.toLowerCase())?.value || '';
    attributes.media_grade = grade('Record Grading') || grade('CD Grading') || grade('Cassette Condition');
    attributes.sleeve_grade = grade('Sleeve Grading') || grade('Case Condition');
  }
  const item = {
    canonical_title: candidate.title, description: candidate.description || '',
    specialist_id: getDefaultSpecialistForNiche(nicheId), status: 'listed',
    inventory_origin: 'ebay_import', identification_source: 'ebay_import',
    identification_confidence: 0, valuation_low: 0, valuation_mid: 0, valuation_high: 0,
    valuation_confidence: 'unknown', expected_selling_price: candidate.price,
    condition: candidate.conditionDisplayName || '', condition_notes: candidate.conditionDescription || '',
    quantity: candidate.quantity || 1, sku: candidate.sku || '',
    attributes, media: candidate.photos || [], warnings: ['eBay listing imported; seller photos and listing details require review.'],
  };
  const publishedAt = candidate.listedAt && Number.isFinite(Date.parse(candidate.listedAt)) ? candidate.listedAt : null;
  const listing = {
    title: candidate.title, description: candidate.description || '', status: 'active',
    price: candidate.price, category_id: candidate.categoryId || null,
    shipping_cost: candidate.shippingCost || 0, watchers: candidate.watchCount || 0,
    published_at: publishedAt, import_source: 'ebay_import',
  };
  return { item, listing };
}
export function matchEbayCandidates(raw: unknown[], knownIds: Set<string>, stock: ExistingStockMatch[]) {
  const index = new Map<string, ExistingStockMatch[]>();
  for (const item of stock) { const key = titleKey(item.title); if (key) index.set(key, [...(index.get(key) || []), item]); }
  const candidates: SellerEbayCandidate[] = [];
  let existing = 0, ignoredNotActive = 0;
  const seen = new Set<string>();
  for (const row of raw) {
    const parsed = validatedSellerListing(row);
    if (!parsed) { ignoredNotActive++; continue; }
    if (seen.has(parsed.itemId)) continue;
    seen.add(parsed.itemId);
    if (knownIds.has(parsed.itemId)) { existing++; continue; }
    candidates.push({ listing: parsed, matches: index.get(titleKey(parsed.title)) || [] });
  }
  return { candidates, existing, ignoredNotActive };
}
async function allRows(client: SupabaseClient, table: 'items' | 'listings', columns: string, tenantId: string, specialists?: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    let query = client.from(table).select(columns).eq('tenant_id', tenantId).order('id').range(offset, offset + 499);
    if (table === 'listings') query = query.in('marketplace_id', ['ebay', 'ebay_gb']).not('external_listing_id', 'is', null);
    if (table === 'items' && specialists?.length) query = query.in('specialist_id', specialists);
    const response = await query;
    if (response.error) throw new Error('SWISH could not check existing listings or inventory: ' + response.error.message);
    rows.push(...((response.data || []) as unknown as Record<string, unknown>[]));
    if ((response.data || []).length < 500) return rows;
  }
  throw new Error('Inventory is larger than this safe reconciliation window. Nothing was imported.');
}
/** The existing backend reads this tenant's linked seller account. This operation is discovery only. */
export async function discoverEbayInventory(client: SupabaseClient, userId: string, tenantId: string, nicheId: SwishNicheId): Promise<SellerDiscovery> {
  await activateModuleScope(client, userId, tenantId, nicheId);
  const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-browse',
    { route: 'my_active_listings', tenantId, nicheId, limit: 400 }, client);
  if (result.error) throw result.error;
  if (!result.data || !Array.isArray(result.data.listings)) throw new Error('eBay did not confirm a seller listing response. No inventory was changed.');
  await verifyModuleScope(client, userId, tenantId, nicheId);
  const [linked, stock] = await Promise.all([
    allRows(client, 'listings', 'id,external_listing_id', tenantId),
    allRows(client, 'items', 'id,canonical_title,status', tenantId, getSpecialistIdsForNiche(nicheId)),
  ]);
  const knownIds = new Set(linked.map(row => value(row.external_listing_id)).filter(Boolean));
  const matching = matchEbayCandidates(result.data.listings, knownIds,
    stock.map(item => ({ id: value(item.id), title: value(item.canonical_title), status: value(item.status) })));
  return {
    ...matching,
    excludedForReview: Math.max(0, Number(result.data.excludedForReview) || 0),
    truncated: result.data.listings.length >= 400,
  };
}
/** A single explicit import; database RPC enforces same tenant + niche and atomic uniqueness. */
export async function importDiscoveredEbayListing(client: SupabaseClient, userId: string, tenantId: string, nicheId: SwishNicheId, candidate: SellerEbayListing, existingItemId?: string) {
  if (!validatedSellerListing(candidate) || candidate.ebayStatus !== 'active') throw new Error('Only verified active seller listings may be imported.');
  await verifyModuleScope(client, userId, tenantId, nicheId);
  if (existingItemId && !/^[0-9a-f-]{36}$/i.test(existingItemId)) throw new Error('Select an existing verified inventory item.');
  const payload = canonicalEbayImportPayload(candidate, nicheId);
  const imported = await client.rpc('swish_import_ebay_inventory', {
    p_tenant_id: tenantId, p_niche_id: nicheId, p_external_id: candidate.itemId,
    p_item: payload.item, p_listing: payload.listing, p_existing_item_id: existingItemId || null,
  });
  if (imported.error || !imported.data?.listingId || !imported.data?.itemId) throw new Error(imported.error?.message || 'Atomic eBay inventory import was not confirmed. Do not create a duplicate.');
  const verified = await client.from('listings').select('id,item_id,external_listing_id,status')
    .eq('id', imported.data.listingId).eq('tenant_id', tenantId).eq('marketplace_id', 'ebay').single();
  if (verified.error || !verified.data || verified.data.external_listing_id !== candidate.itemId || verified.data.item_id !== imported.data.itemId || verified.data.status !== 'active') {
    throw new Error('Import may have succeeded, but its canonical eBay identity was not confirmed. Refresh before retrying.');
  }
  return { itemId: String(imported.data.itemId), listingId: String(imported.data.listingId), reused: Boolean(imported.data.existing) };
}
