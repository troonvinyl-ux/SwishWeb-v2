import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Eye, Star, Tag, Store } from 'lucide-react';
import { asRecord } from '@/lib/itemPhotos';
import { selectedInventoryPrice, type InventoryEntry } from '@/lib/inventoryNative';
import { formatCurrency } from '@/lib/utils';
import CoinPresentation from '@/components/features/CoinPresentation';
import { InventoryPriceAction, ListingStatusAction, RemoveFromSwishAction } from '@/components/features/InventoryListingActions';

export default function InventoryCard({ entry, tenantId, nicheId }: {
  entry: InventoryEntry; tenantId: string; nicheId: string;
}) {
  const navigate = useNavigate();
  const { item, listing, tab } = entry;
  const attrs = asRecord(item.attributes);
  const title = String(item.canonical_title || listing?.title || 'Unidentified item');
  const rawDetail = String(item.condition || '');
  const detail = String(item.specialist_id !== 'vinyl_records' && /^Media[: ]/i.test(rawDetail)
    ? attrs.denomination || attrs.period || '' : rawDetail || attrs.denomination || attrs.period || '');
  const price = selectedInventoryPrice(entry);
  const hasPrice = price > 0;
  const status = tab === 'stock' ? 'In Stock' : tab === 'draft' ? 'Draft' :
    tab === 'live' ? 'Live on eBay' : 'Sold';
  const id = String(listing?.external_listing_id || '');
  const ebayUrl = /^\d{6,20}$/.test(id) ? 'https://www.ebay.co.uk/itm/' + id : '';
  const path = listing && (tab === 'draft' || tab === 'live')
    ? '/listings/' + listing.id : '/inventory/' + entry.id;
  const inventoryReference = String(item.inventory_id || item.sku || '').trim();
  const storage = String(item.storage_location || attrs.storage_location || '').trim();

  return <article className="swish-inventory-card" data-status={tab} data-item-id={entry.id}>
    <button className="swish-inventory-card-main" type="button" onClick={() => navigate(path)} aria-label={'View ' + title}>
      <div className="swish-inventory-thumb"><CoinPresentation item={item} alt={title}/></div>
      <div className="swish-inventory-card-copy">
        <strong>{title}</strong>
        {inventoryReference && <span className="inventory-row-detail">SWISH {inventoryReference}</span>}
        {detail && <span className="inventory-row-detail">{detail}</span>}
        {storage && <span className="inventory-row-detail">Storage: {storage}</span>}
        {attrs._photo_pipeline && asRecord(attrs._photo_pipeline).status !== 'complete' &&
          <span role="status" className="text-xs text-warning">Saved photos may need recovery — open this item</span>}
        <div className="inventory-price-row">
          <span className="swish-inventory-status">{status}</span>
          <b className="swish-inventory-price">{hasPrice ? formatCurrency(price) : 'Not priced'}</b>
        </div>
        {tab === 'live' && listing && <div className="inventory-row-stats">
          <span><Eye size={16}/>{String(listing.views ?? '—')} views</span>
          <span><Star size={16}/>{String(listing.watchers ?? '—')} watchers</span>
        </div>}
        {tab === 'sold' && item.sold_at && <span className="inventory-row-detail">Sold: {new Date(String(item.sold_at)).toLocaleDateString('en-GB')}</span>}
      </div>
      <ChevronRight size={18} className="swish-inventory-chevron"/>
    </button>
    <div className="flex flex-wrap items-start gap-2 px-3 pb-3">
      {tab === 'stock' && <Link className="swish-inventory-submit min-h-10" to={'/listings/new?item_id=' + encodeURIComponent(entry.id)}>
        <Tag size={16}/><span>List</span>
      </Link>}
      {tab === 'draft' && listing && <Link className="swish-inventory-submit min-h-10" to={'/listings/' + listing.id + '/edit'}>
        <Tag size={16}/><span>Review draft</span>
      </Link>}
      {listing && (tab === 'draft' || tab === 'live' || tab === 'sold') &&
        <ListingStatusAction listing={listing} tenantId={tenantId} nicheId={nicheId}/>}
      {tab === 'live' && listing &&
        <InventoryPriceAction entry={entry} tenantId={tenantId} nicheId={nicheId}/>}
      {tab === 'live' && listing && nicheId === 'coins' &&
        <RemoveFromSwishAction entry={entry} tenantId={tenantId} nicheId={nicheId}/>}

      {tab === 'live' && ebayUrl && <a className="swish-inventory-submit is-live min-h-10" href={ebayUrl}
        target="_blank" rel="noreferrer" aria-label="View linked eBay listing"><Store size={16}/><span>eBay</span></a>}
    </div>
  </article>;
}
