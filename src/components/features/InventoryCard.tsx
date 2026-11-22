import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Eye, Star, Tag, Store, Send } from 'lucide-react';
import { asRecord, photoUrl } from '@/lib/itemPhotos';
import { positiveMoney } from '@/lib/itemPricing';
import { formatCurrency } from '@/lib/utils';
import CoinPresentation from '@/components/features/CoinPresentation';
import type { InventoryCardProps } from '@/types/inventory';
export default function InventoryCard({ row, item, tab }: InventoryCardProps) {
  const navigate = useNavigate(), listing = tab === 'draft' || tab === 'live', attrs = asRecord(item?.attributes);
  const title = String(listing ? row.title || row.listing_title || item?.canonical_title || 'Untitled listing' : item?.canonical_title || row.title || row.name || 'Unidentified item');
  const detail = String(item?.condition || attrs.denomination || attrs.period || '');
  const price = listing ? positiveMoney(row.price) : positiveMoney(item?.expected_selling_price, item?.valuation_mid, row.valuation);
  const url = listing ? `/listings/${row.id}` : `/inventory/${row.id}`;
  const status = tab === 'stock' ? 'In Stock' : tab === 'draft' ? 'Draft' : tab === 'live' ? 'Live on eBay' : 'Sold';
  const ebay = photoUrl(row.url);
  return <article className="swish-inventory-card" data-status={tab}>
    <button className="swish-inventory-card-main" type="button" onClick={() => navigate(url)} aria-label={`View ${title}`}>
      <div className="swish-inventory-thumb"><CoinPresentation item={item || row} alt={title} /></div>
      <div className="swish-inventory-card-copy"><strong>{title}</strong>{detail && <span className="inventory-row-detail">{detail}</span>}
        <div className="inventory-price-row"><span className="swish-inventory-status">{status}</span><b className="swish-inventory-price">{price === null ? 'Not priced' : formatCurrency(price)}</b></div>
        {tab === 'live' && <div className="inventory-row-stats"><span><Eye size={16} />{String(row.views ?? row.view_count ?? '—')} views</span><span><Star size={16} />{String(row.watchers ?? row.watch_count ?? '—')} watchers</span></div>}
      </div><ChevronRight size={18} className="swish-inventory-chevron" />
    </button>
    {tab === 'stock' && <Link className="swish-inventory-submit" to={`/listings/new?item_id=${row.id}`}><Tag size={16} /><span>List</span></Link>}
    {tab === 'draft' && <Link className="swish-inventory-submit" to={`/listings/${row.id}/edit`}><Send size={16} /><span>Submit</span></Link>}
    {tab === 'live' && ebay && <a className="swish-inventory-submit is-live" href={ebay} target="_blank" rel="noreferrer" aria-label="View live listing on eBay"><Store size={16} /><span>eBay</span></a>}
  </article>;
}
