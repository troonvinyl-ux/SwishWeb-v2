import { ChevronRight, FileText, Truck, Tag, Image, BarChart3, ListChecks } from 'lucide-react';
import { itemPricing } from '@/lib/itemPricing';
import { formatCurrency } from '@/lib/utils';
import { itemPhotos } from '@/lib/itemPhotos';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, ExternalLink } from 'lucide-react';
import { useItemIntelligence } from '@/hooks/useItemIntelligence';
import { photoUrl } from '@/lib/itemPhotos';
import CoinPresentation from '@/components/features/CoinPresentation';
import ItemOverview from '@/components/features/ItemOverview';
import ItemMarketValue from '@/components/features/ItemMarketValue';
import ItemReidentifyReview from '@/components/features/ItemReidentifyReview';
import ItemPhotoGallery from '@/components/features/ItemPhotoGallery';
interface ItemDetailWorkspaceProps { item: Record<string, unknown> | null; listing?: Record<string, unknown> | null; onEditItem?: () => void; onCreateListingDraft?: () => void; creatingListingDraft?: boolean; listingDraftMessage?: string | null; }
const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'market', label: 'Market value' }, { id: 'reid', label: 'Re-ID' }, { id: 'photos', label: 'Photos' }];
export default function ItemDetailWorkspace({ item, listing = null, onEditItem, onCreateListingDraft, creatingListingDraft = false, listingDraftMessage = null }: ItemDetailWorkspaceProps) {
  const [params, setParams] = useSearchParams(), intelligence = useItemIntelligence(item);
  const tab = TABS.some(value => value.id === params.get('view')) ? params.get('view')! : 'overview';
  const select = (id: string) => { const next = new URLSearchParams(params); next.set('view', id); setParams(next, { replace: true }); };
  const title = String(listing?.title || item?.canonical_title || 'Inventory record');
  const ebay = photoUrl(listing?.url) || (/^\d+$/.test(String(listing?.external_listing_id || '')) ? `https://www.ebay.co.uk/itm/${listing?.external_listing_id}` : null);
  const busy = intelligence.identify.isPending || intelligence.value.isPending || intelligence.apply.isPending;
  const pricing = itemPricing(item, listing);
  const live = ['active','live'].includes(String(listing?.status));
  const editor = listing ? `/listings/${listing.id}/edit` : '';
  return <div className="item-detail-workspace animate-fade-in flip-listing">
    <header className="flex items-start gap-3"><Link to={listing ? '/inventory?tab=live' : '/inventory'} className="btn-ghost shrink-0" aria-label="Back to inventory"><ArrowLeft className="h-5 w-5" /></Link><div><p className="text-sm text-primary font-semibold mb-1">{listing ? live ? 'Your listing is live!' : 'Ready to sell?' : 'Inventory overview'}</p><h1 className="text-2xl font-bold leading-tight">{title}</h1></div></header>
    <div className="item-detail-layout"><aside className="space-y-4">
      <CoinPresentation item={item} alt={title} className="item-detail-cover" /><button type="button" className="flip-row" onClick={() => select("photos")}><Image size={20}/><span>{itemPhotos(item).length} photos · View or edit</span><ChevronRight size={18}/></button>
      <div className="swish-card p-4 space-y-3"><p className="capitalize font-semibold">{listing ? String(listing.status || 'Draft') : String(item?.status || 'In stock').replace(/_/g, ' ')}</p>
        {listing ? <Link to={`/listings/${listing.id}/edit`} className={`${tab === 'reid' && intelligence.candidate ? 'btn-secondary' : 'btn-primary'} w-full justify-center`}><Edit2 className="h-4 w-4" />{['active', 'live'].includes(String(listing.status)) ? 'Review listing editor' : 'Edit / submit draft'}</Link> : onEditItem ? <button type="button" onClick={onEditItem} className={`${tab === 'reid' && intelligence.candidate ? 'btn-secondary' : 'btn-primary'} w-full justify-center`}><Edit2 className="h-4 w-4" />Edit inventory</button> : null}
        {ebay && <a href={ebay} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center"><ExternalLink className="h-4 w-4" />View on eBay</a>}
        {listing && item && <Link to={`/inventory/${item.id}`} className="btn-ghost w-full justify-center">Open inventory record</Link>}
        {!listing && item && !['sold', 'fulfilled', 'completed'].includes(String(item.status)) && (onCreateListingDraft ? <button type="button" onClick={onCreateListingDraft} disabled={creatingListingDraft || Boolean(listingDraftMessage)} title={listingDraftMessage || undefined} className="btn-secondary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{creatingListingDraft ? 'Preparing listing draft…' : 'Create listing draft'}</button> : <Link to={`/listings/new?item_id=${item.id}`} className="btn-secondary w-full justify-center">Create listing draft</Link>)}
        {!listing && listingDraftMessage && <p className="text-xs leading-5 text-muted-foreground">{listingDraftMessage}</p>}
      </div>
    </aside><div className="min-w-0 space-y-4">
      <nav className="item-detail-tabs" aria-label="Item details">{TABS.map(value => <button key={value.id} type="button" aria-current={tab === value.id ? 'page' : undefined} className={tab === value.id ? 'is-selected' : ''} onClick={() => select(value.id)}>{value.label}</button>)}</nav>
      {!item && <p role="status" className="swish-card p-4 text-muted-foreground">No linked inventory item is available. Market research and Re-ID require the original item.</p>}
      {tab === 'overview' && <div className="space-y-3">
        <div className="flip-price"><Tag size={24}/><span><small>{pricing.actual === null ? 'Suggested selling price' : 'Selling price'}</small><strong>{(pricing.actual ?? pricing.suggested) === null ? 'Not set' : formatCurrency((pricing.actual ?? pricing.suggested)!)}</strong></span>{listing && !live && <Link to={editor+'?section=pricing'} className="btn-secondary">Edit</Link>}</div>
        {listing && !live && [{key:'description',label:'Title & description',Icon:FileText},{key:'specifics',label:'Listing specifics',Icon:ListChecks},{key:'pricing',label:'Pricing',Icon:Tag},{key:'delivery',label:'Delivery',Icon:Truck}].map(row=><Link key={row.key} to={editor+'?section='+row.key} className="flip-row"><row.Icon size={22}/><span><strong>{row.label}</strong><small>View or edit</small></span><ChevronRight size={20}/></Link>)}
        <button type="button" className="flip-row" onClick={()=>select('market')}><BarChart3 size={22}/><span><strong>Research &amp; valuation</strong><small>More information</small></span><ChevronRight size={20}/></button>
        <details><summary className="flip-row cursor-pointer"><ListChecks size={22}/><span><strong>Advanced details</strong><small>Inventory and specialist information</small></span><ChevronRight size={20}/></summary><div className="mt-3"><ItemOverview item={item} listing={listing}/></div></details>
        {listing && !live && <Link to={editor} className="flip-primary">Review &amp; list on eBay</Link>}
      </div>}
      {tab === 'market' && <ItemMarketValue item={item} listing={listing} result={intelligence.market} busy={busy} onRefresh={() => intelligence.value.mutate()} />}
      {tab === 'reid' && <ItemReidentifyReview item={item} candidate={intelligence.candidate} busy={busy} saving={intelligence.apply.isPending} onIdentify={() => intelligence.identify.mutate()} onApply={() => intelligence.apply.mutate()} onDismiss={intelligence.dismiss} />}
      {tab === 'photos' && <ItemPhotoGallery item={item} />}
    </div></div>
  </div>;
}
