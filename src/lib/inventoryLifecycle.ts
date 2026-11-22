/** The canonical stock item can have a saved draft and a separate verified live eBay listing.
 * One physical item must not be counted as both live and awaiting its first publication. */
export function resolvedInventoryListings(rows: Record<string, unknown>[]) {
  const linkedLiveItems = new Set(rows.filter(row =>
    ['active', 'live'].includes(String(row.status || '').toLowerCase()) &&
    /^\d{6,20}$/.test(String(row.external_listing_id || '')) && row.item_id,
  ).map(row => String(row.item_id)));
  const draft = rows.filter(row =>
    ['draft', 'pending'].includes(String(row.status || '').toLowerCase()) &&
    !linkedLiveItems.has(String(row.item_id || '')),
  );
  const live = rows.filter(row => ['active', 'live'].includes(String(row.status || '').toLowerCase()));
  return { draft, live, linkedLiveItems };
}
/** A saved original draft may not be submitted again after another linked eBay publication exists. */
export function hasLiveSibling(existing: Record<string, unknown>[], ownId: string): boolean {
  return existing.some(row => String(row.id) !== ownId &&
    ['active', 'live'].includes(String(row.status || '').toLowerCase()) &&
    /^\d{6,20}$/.test(String(row.external_listing_id || '')));
}
