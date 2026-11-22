import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Eye, Star, Tag, Store, RefreshCw } from 'lucide-react';
import { asRecord, photoUrl } from '@/lib/itemPhotos';
import { positiveMoney } from '@/lib/itemPricing';
import { formatCurrency } from '@/lib/utils';
import CoinPresentation from '@/components/features/CoinPresentation';
import type { InventoryCardProps } from '@/types/inventory';
export default function InventoryCard({ row, item, tab, onCheckListing, checkingId }: InventoryCardProps) {
  const navigate = useNavigate(), listing = tab === 'draft' || tab === 'live', attrs = asRecord(item?.attributes);
  const title = String(listing ? row.title || row.listing_title || item?.canonical_title || 'Untitled listing' : item?.canonical_title || row.title || row.name || 'Unidentified item');
  const rawDetail = String(item?.condition || '');
  const detail = String(item?.specialist_id !== 'vinyl_records' && /^Media[: ]/i.test(rawDetail) ? attrs.denomination || attrs.period || '' : rawDetail || attrs.denomination || attrs.period || '');
  const price = listing ? positiveMoney(row.price) : positiveMoney(item?.expected_selling_price, item?.valuation_mid, row.valuation);
  const url = listing ? `/listings/${row.id}` : `/inventory/${row.id}`;
  const status = tab === 'stock' ? 'In Stock' : tab === 'draft' ? 'Draft' : tab === 'live' ? 'Live on eBay' : 'Sold';
  const ebay = photoUrl(row.url);
  const linkedEbayId = String(row.external_listing_id || '');
  return <article className="swish-inventory-card" data-status={tab}>
    <button className="swish-inventory-card-main" type="button" onClick={() => navigate(url)} aria-label={`View ${title}`}>
      <div className="swish-inventory-thumb"><CoinPresentation item={item || row} alt={title} /></div>
      <div className="swish-inventory-card-copy"><strong>{title}</strong>{detail && <span className="inventory-row-detail">{detail}</span>}
        <div className="inventory-price-row"><span className="swish-inventory-status">{status}</span><b className="swish-inventory-price">{price === null ? 'Not priced' : formatCurrency(price)}</b></div>
        {tab === 'live' && <div className="inventory-row-stats"><span><Eye size={16} />{String(row.views ?? row.view_count ?? '—')} views</span><span><Star size={16} />{String(row.watchers ?? row.watch_count ?? '—')} watchers</span></div>}
      </div><ChevronRight size={18} className="swish-inventory-chevron" />
    </button>
    {tab === 'stock' && <Link className="swish-inventory-submit" to={`/listings/new?item_id=${row.id}`}><Tag size={16} /><span>List</span></Link>}
    {tab === 'draft' && /^\\d{6,20}$/.test(linkedEbayId) && onCheckListing
      ? <button type="button" className="swish-inventory-submit" disabled={Boolean(checkingId)} onClick={() => void onCheckListing(String(row.id))}><RefreshCw size={16}/><span>{checkingId === row.id ? 'Checking…' : 'Check eBay'}</span></button>
      : tab === 'draft' && <Link className="swish-inventory-submit" to={`/listings/${row.id}/edit`}><span>Review</span></Link>}
    {tab === 'live' && ebay && <a className="swish-inventory-submit is-live" href={ebay} target="_blank" rel="noreferrer" aria-label="View live listing on eBay"><Store size={16} /><span>eBay</span></a>}
  </article>;
}
