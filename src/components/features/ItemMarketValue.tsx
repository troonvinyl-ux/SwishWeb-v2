import { RefreshCw } from 'lucide-react';
import { asRecord } from '@/lib/itemPhotos';
import { savedMarketData, itemPricing, displayValue } from '@/lib/itemPricing';
import { formatCurrency } from '@/lib/utils';
import ItemPricingSummary from '@/components/features/ItemPricingSummary';
interface ItemMarketValueProps { item: Record<string, unknown> | null; listing?: Record<string, unknown> | null; result: Record<string, unknown> | null; busy: boolean; onRefresh: () => void; }
export default function ItemMarketValue({ item, listing, result, busy, onRefresh }: ItemMarketValueProps) {
  const data = result ?? savedMarketData(item), sold = asRecord(data.soldMarket), asking = asRecord(data.activeAskingPrices), valuation = asRecord(data.valuation);
  const pricing = itemPricing(item, listing, data);
  const warnings = Array.isArray(valuation.valuationWarnings) ? valuation.valuationWarnings : [];
  return <div className="space-y-4">
    <section className="swish-card p-5 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Market value</h2><button type="button" className="btn-secondary" disabled={!item || busy} onClick={onRefresh}><RefreshCw className="h-4 w-4" />{busy ? 'Researching…' : 'Refresh market value'}</button></div>
      <p className="text-muted-foreground leading-relaxed">Sold evidence and active asking prices are different. Review the source, condition and attribution before using this estimate.</p>
      {pricing.market === null && <p className="text-muted-foreground">No verified market estimate is saved yet. No price has been inferred.</p>}
      {pricing.low !== null && pricing.high !== null && <p>Estimated range: <strong className="text-primary">{formatCurrency(pricing.low)} – {formatCurrency(pricing.high)}</strong></p>}
    </section>
    <ItemPricingSummary item={item} listing={listing} market={data} />
    <div className="grid gap-4 sm:grid-cols-2"><section className="swish-card p-5 space-y-3"><h3 className="font-semibold">Verified sold evidence</h3><p className="text-2xl text-primary">{Number(sold.verifiedSoldCount) > 0 && Number(sold.medianPrice) > 0 ? formatCurrency(Number(sold.medianPrice)) : 'Unavailable'}</p><p className="text-sm text-muted-foreground">{sold.verifiedSoldCount != null ? `${displayValue(sold.verifiedSoldCount)} verified sales` : 'No verified sales returned.'}</p>{Boolean(sold.dataQualityReason) && <p className="text-sm leading-relaxed text-muted-foreground">{displayValue(sold.dataQualityReason)}</p>}</section>
      <section className="swish-card p-5 space-y-3"><h3 className="font-semibold">Active asking prices</h3><p className="text-2xl">{Number(asking.medianAskingPrice) > 0 ? formatCurrency(Number(asking.medianAskingPrice)) : 'Unavailable'}</p><p className="text-sm text-muted-foreground">Reference only — not completed sales.</p></section></div>
    {Boolean(valuation.listingPriceRationale) && <section className="swish-card p-5"><h3 className="font-semibold mb-2">Pricing reasoning</h3><p className="leading-relaxed text-muted-foreground">{displayValue(valuation.listingPriceRationale)}</p></section>}
    {warnings.length > 0 && <div role="status" className="swish-card p-5 text-warning">{warnings.map(String).join(' · ')}</div>}
  </div>;
}
