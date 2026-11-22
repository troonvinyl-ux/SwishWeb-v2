/** Canonical SWISH inventory contract shared with the native app.
 * One stock item has one inventory tab regardless of how many eBay rows exist. */
export type CanonicalTab = 'stock' | 'draft' | 'live' | 'sold';
export type InventoryOrder = 'newest' | 'oldest' | 'title' | 'price_high' | 'price_low' | 'watchers' | 'views';
export const INVENTORY_ORDERS: ReadonlyArray<{ id: InventoryOrder; label: string }> = [
  { id: 'newest', label: 'Newest first' }, { id: 'oldest', label: 'Oldest first' },
  { id: 'title', label: 'Name A–Z' }, { id: 'price_high', label: 'Price high–low' },
  { id: 'price_low', label: 'Price low–high' }, { id: 'watchers', label: 'Most watchers' },
  { id: 'views', label: 'Most views' },
];
export interface CanonicalCounts {
  total: number; units: number; stock: number; draft: number; live: number;
  sold: number; archived: number; liveListings: number; revision?: string;
}
export interface InventoryEntry {
  id: string;
  tab: CanonicalTab | 'archived';
  item: Record<string, unknown>;
  listing: Record<string, unknown> | null;
  sortAt: string;
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const money = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export function parseCanonicalCounts(value: unknown): CanonicalCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SWISH could not verify canonical inventory counts.');
  const data = value as Record<string, unknown>;
  const count = (key: string) => {
    const n = data[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error('Canonical inventory count contract was not confirmed.');
    return n;
  };
  const counts: CanonicalCounts = {
    total: count('total'), units: count('units'), stock: count('stock'), draft: count('draft'),
    live: count('live'), sold: count('sold'), archived: count('archived'), liveListings: count('live_listings'),
  };
  if (counts.stock + counts.draft + counts.live + counts.sold + counts.archived !== counts.total)
    throw new Error('Canonical inventory categories do not reconcile. Refresh inventory.');
  if (data.revision !== undefined) {
    if (typeof data.revision !== 'string' || !/^[a-f0-9]{32}$/.test(data.revision))
      throw new Error('Canonical inventory revision was not confirmed.');
    counts.revision = data.revision;
  }
  if (data.status_counts !== undefined) {
    if (!data.status_counts || typeof data.status_counts !== 'object' || Array.isArray(data.status_counts))
      throw new Error('Canonical stock-status counts are invalid.');
    const values = Object.values(data.status_counts);
    if (values.some(v => typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) ||
        (values as number[]).reduce((sum, n) => sum + n, 0) !== counts.total)
      throw new Error('Canonical stock-status totals do not reconcile.');
  }
  return counts;
}
/** A projection is an item with an optional selected eBay listing, never another stock item. */
export function projectInventoryRows(data: unknown[], tenantId: string, specialists: readonly string[]): InventoryEntry[] {
  const seen = new Set<string>();
  return data.map(value => {
    const row = object(value), item = object(row.item), listing = row.listing == null ? null : object(row.listing);
    const id = text(row.item_id || item.id), tab = row.inventory_tab;
    if (!id || !['stock', 'draft', 'live', 'sold', 'archived'].includes(String(tab)) ||
        !specialists.includes(String(row.specialist_id || item.specialist_id)) ||
        (item.id && item.id !== id) || (item.tenant_id && item.tenant_id !== tenantId) ||
        (listing && (!listing.id || (listing.item_id && listing.item_id !== id) ||
          (listing.tenant_id && listing.tenant_id !== tenantId))) || seen.has(id))
      throw new Error('SWISH inventory projection is inconsistent. Refresh instead of counting duplicates.');
    seen.add(id);
    return { id, tab: tab as InventoryEntry['tab'], item: { ...item, id }, listing,
      sortAt: text(row.sort_at || item.created_at) };
  });
}
export function inventoryCountsInView(entries: readonly InventoryEntry[]) {
  const counts: Record<CanonicalTab | 'archived', number> = { stock: 0, draft: 0, live: 0, sold: 0, archived: 0 };
  entries.forEach(entry => { counts[entry.tab] += 1; });
  return counts;
}
export function selectedInventoryPrice(entry: InventoryEntry): number {
  const value = entry.tab === 'sold' ? entry.item.sold_price :
    entry.listing?.price ?? entry.item.expected_selling_price ?? entry.item.valuation_mid;
  return money(value) ?? 0;
}
/** Mirrors native recommendedInventoryPrice: saved seller recommendation, never a
 * second automatic 5% discount; floor/ceiling and existing seller price stay distinct. */
export function recommendedInventoryPrice(entry: InventoryEntry): number | null {
  if (entry.tab !== 'live' || !entry.listing ||
      !['active', 'live', 'published'].includes(String(entry.listing.status || '').toLowerCase()) ||
      !/^\d{6,20}$/.test(String(entry.listing.external_listing_id ?? '')) ||
      entry.item.sold_at || ['sold', 'fulfilled', 'completed'].includes(String(entry.item.status || '').toLowerCase()))
    return null;
  const suggested = money(entry.item.expected_selling_price), current = money(entry.listing.price);
  if (suggested === null || suggested <= 0 || current === null || current <= 0 ||
      Math.round(suggested * 100) === Math.round(current * 100)) return null;
  const floor = money(entry.listing.floor_price) ?? 0;
  const ceiling = money(entry.listing.ceiling_price) ?? 0;
  if (suggested < floor || (ceiling > 0 && suggested > ceiling)) return null;
  const attributes = object(entry.item.attributes), options = object(attributes.ebay_listing_options);
  if (options.listingType === 'Chinese') return null;
  return Math.round(suggested * 100) / 100;
}
export function orderInventory(entries: readonly InventoryEntry[], order: InventoryOrder): InventoryEntry[] {
  const date = (entry: InventoryEntry) => Date.parse(text(entry.item.created_at || entry.sortAt)) || 0;
  const title = (entry: InventoryEntry) => text(entry.item.canonical_title).toLocaleLowerCase();
  return [...entries].sort((a, b) => {
    const number = (key: string, entry: InventoryEntry) => money(entry.listing?.[key]) ?? 0;
    const diff = order === 'title' ? title(a).localeCompare(title(b), undefined, { numeric: true }) :
      order === 'oldest' ? date(a) - date(b) :
      order === 'price_high' ? selectedInventoryPrice(b) - selectedInventoryPrice(a) :
      order === 'price_low' ? selectedInventoryPrice(a) - selectedInventoryPrice(b) :
      order === 'watchers' ? number('watchers', b) - number('watchers', a) :
      order === 'views' ? number('views', b) - number('views', a) : date(b) - date(a);
    return diff || a.id.localeCompare(b.id);
  });
}
export function searchInventory(entries: readonly InventoryEntry[], query: string): InventoryEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...entries];
  return entries.filter(({ item, listing }) => {
    const attrs = object(item.attributes);
    return [item.canonical_title, item.inventory_id, item.sku, item.catalogue_number,
      item.storage_location, attrs.numista_type_id, attrs.denomination, attrs.period,
      attrs.mint, attrs.folder_number, listing?.title, listing?.external_listing_id]
      .some(value => String(value ?? '').toLowerCase().includes(term));
  });
}
