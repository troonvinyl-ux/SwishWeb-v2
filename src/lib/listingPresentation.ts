export type ListingTab = 'all' | 'draft' | 'live' | 'sold' | 'ended' | 'attention';
export const LISTING_TABS: { id: ListingTab; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'draft', label: 'Drafts' }, { id: 'live', label: 'Live' },
  { id: 'sold', label: 'Sold' }, { id: 'ended', label: 'Ended' }, { id: 'attention', label: 'Needs attention' },
];
export function listingTab(row: Record<string, unknown>): ListingTab {
  if (row.publish_claim_id) return 'attention';
  const status = String(row.status || '').toLowerCase();
  if (['active', 'live', 'published'].includes(status)) return 'live';
  if (['sold', 'completed'].includes(status)) return 'sold';
  if (['ended', 'archived', 'cancelled'].includes(status)) return 'ended';
  if (['failed', 'error', 'review_required'].includes(status)) return 'attention';
  return 'draft';
}
/** Native buyer-facing preview: text only, never inject catalogue/provider HTML. */
export function listingDescriptionText(value: unknown): string {
  const text = String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || whole;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  }).replace(/\s+/g, ' ').trim();
}
