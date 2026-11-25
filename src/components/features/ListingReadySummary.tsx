import { Image, ChevronRight, FileText, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { itemPricing } from '@/lib/itemPricing';
import { listingDescriptionText } from '@/lib/listingPresentation';
interface ListingReadySummaryProps { form: Record<string, unknown>; item: Record<string, unknown> | null; photos: string[]; onOpen: (section: string) => void; }
export default function ListingReadySummary({ form, item, photos, onOpen }: ListingReadySummaryProps) {
  const price = itemPricing(item, form), description = listingDescriptionText(form.description);
  return <div className="min-w-0 space-y-4">
    <button type="button" className="flip-cover" onClick={() => onOpen('photos')} aria-label="Review listing photos">
      {photos[0] ? <img src={photos[0]} alt="Main listing photo" /> : <Image size={48} />}
      <span><Image size={18} />{photos.length} photos · View or edit <ChevronRight size={18} /></span>
    </button>
    <div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Your eBay listing</p><h2 className="mt-2 break-words text-xl font-bold">{String(form.title || 'Your item')}</h2><p className="mt-2 text-muted-foreground">{String(form.category || 'Category needed')} · {Number(form.quantity || 1)} {Number(form.quantity || 1) === 1 ? 'item' : 'items'}</p><p className="text-muted-foreground">{String(form.condition || form.condition_description || 'Condition not established')}</p></div>
    {photos.length > 1 && <div className="flex min-w-0 gap-2 overflow-x-auto pb-2" aria-label="Selected photos">{photos.slice(1).map((url, index) => <button type="button" key={`${url}:${index}`} onClick={() => onOpen('photos')} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary" aria-label={`Review photo ${index + 2}`}><img src={url} alt={`Listing photo ${index + 2}`} className="h-full w-full object-contain" loading="lazy" /></button>)}</div>}
    <button type="button" className="flip-row" onClick={() => onOpen('research')}><TrendingUp size={22} /><span><strong>Market estimate · {price.market === null ? 'Not available' : formatCurrency(price.market)}</strong><small>{price.low !== null && price.high !== null ? `${formatCurrency(price.low)}–${formatCurrency(price.high)} · ` : ''}Research evidence, not a guaranteed sale price</small></span><ChevronRight size={20} /></button>
    <section className="swish-card space-y-3 p-4"><h3 className="text-lg font-semibold">Buyer description</h3><p className="line-clamp-3 text-base leading-7 text-muted-foreground">{description || 'Add an accurate description of the item, included parts and defects.'}</p><button type="button" className="btn-secondary min-h-11" onClick={() => onOpen('description')}><FileText size={18} />Edit details</button></section>
  </div>;
}
