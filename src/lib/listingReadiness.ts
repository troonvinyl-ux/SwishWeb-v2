import type { ReadinessCheck } from '@/types/listingReadiness';
export function publicationBlock(listing: Record<string, unknown>): string | null {
  // Only recorded listings and terminal states disable the web submit button.
  // Pending operation claims are adjudicated atomically by swish-ebay-list.
  return listing.external_listing_id || ['active','live','published','sold','ended'].includes(String(listing.status).toLowerCase()) ? 'This listing already has a recorded eBay submission or is closed. Open it below or refresh its status.' : null;
}
export function permanentListingPhoto(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && ![...url.searchParams.keys()].some(key => /token|signature|credential|expires|key/i.test(key)); } catch { return false; }
}
interface ReadinessInput { listing: Record<string, unknown>; item: Record<string, unknown> | null; tenantId: string | null; specialistIds: string[]; photos: string[]; dirty: boolean; }
export function listingReadiness({ listing, item, tenantId, specialistIds, photos, dirty }: ReadinessInput): ReadinessCheck[] {
  const check = (id: string, label: string, pass: boolean, detail: string): ReadinessCheck => ({ id, label, status: pass ? 'pass' : 'fail', detail });
  return [
    check('saved','Saved draft',Boolean(listing.id) && !dirty,'Save current changes before verification.'),
    check('scope','Workspace and stock',Boolean(tenantId && listing.tenant_id === tenantId && item && item.tenant_id === tenantId && item.id === listing.item_id && specialistIds.includes(String(item.specialist_id)) && item.status !== 'sold' && !item.sold_at),'Use available stock from this specialist and workspace.'),
    check('title','Listing title',String(listing.title || '').trim().length >= 10,'Use an accurate, descriptive title.'),
    check('description','Description',Boolean(String(listing.description || '').trim()),'Describe the actual item and its condition.'),
    check('price','Selling price',Number.isFinite(Number(listing.price)) && Number(listing.price) > 0,'Set a finite selling price above zero.'),
    check('photos','Original photos',photos.length > 0 && photos.every(permanentListingPhoto),'Use permanent HTTPS photo URLs.'),
    check('publication','Submission status',!publicationBlock(listing),'An existing submission must be inspected before another attempt.'),
    { id:'category', label:'eBay category and specifics',status: 'review',detail:'The shared eBay service resolves and validates the category, condition and required specifics during submission.' },
  ];
}
