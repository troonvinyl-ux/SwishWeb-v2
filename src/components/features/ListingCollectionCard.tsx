import { Link } from 'react-router-dom';
import { Image, ExternalLink, ChevronRight } from 'lucide-react';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
import { formatCurrency } from '@/lib/utils';
import { itemPricing } from '@/lib/itemPricing';
import { listingTab } from '@/lib/listingPresentation';
interface ListingCollectionCardProps { listing: Record<string, unknown>; }
export default function ListingCollectionCard({ listing }: ListingCollectionCardProps) {
  const relation = Array.isArray(listing.items) ? listing.items[0] : listing.items;
  const item = asRecord(relation), cover = itemPhotos(item)[0]?.presentation, tab = listingTab(listing);
  const price = itemPricing(item, listing).actual, id = String(listing.id), externalId = String(listing.external_listing_id || '');
  const label = tab === 'attention' ? listing.publish_claim_id ? 'Submission pending' : 'Needs attention' : tab === 'live' ? 'Live on eBay' : tab === 'sold' ? 'Sold' : tab === 'ended' ? 'Ended' : 'Saved draft';
  return <article className="listing-collection-card">
    <Link to={`/listings/${id}/edit`} className="listing-collection-main" aria-label={`${tab === 'draft' ? 'Review draft' : 'Open listing'}: ${String(listing.title || 'Untitled item')}`}>
      <span className="listing-collection-thumb">{cover ? <img src={cover} alt="Listing item" loading="lazy" /> : <Image size={26} />}</span>
      <span className="min-w-0 space-y-2"><span className={`listing-collection-status ${tab === 'attention' ? 'is-attention' : ''}`}>{label}</span><strong className="line-clamp-2 block text-base font-semibold leading-6">{String(listing.title || 'Untitled item')}</strong><span className="block text-xl font-bold text-primary">{price === null ? 'Price not set' : formatCurrency(price)}</span><span className="block text-sm text-muted-foreground">{listing.publish_claim_id ? 'Check the original submission; do not publish again' : tab === 'draft' ? 'Review photos, details and delivery' : externalId ? `eBay item ${externalId}` : 'Saved in SWISH'}</span></span><ChevronRight size={20} className="ml-auto shrink-0 text-muted-foreground" />
    </Link>
    {/^[0-9]{6,20}$/.test(externalId) && <a className="btn-ghost min-h-11 shrink-0" href={`https://www.ebay.co.uk/itm/${externalId}`} target="_blank" rel="noopener noreferrer" aria-label="View existing listing on eBay"><ExternalLink size={20} /></a>}
  </article>;
}
