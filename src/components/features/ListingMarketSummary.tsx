import { RefreshCw, TrendingUp, Check, AlertCircle } from 'lucide-react';
import { useListingMarketValue } from '@/hooks/useListingMarketValue';
import { savedMarketData, itemPricing, positiveMoney } from '@/lib/itemPricing';
import { asRecord } from '@/lib/itemPhotos';
import { savedMusicPrice } from '@/lib/musicSavedItem';
import { formatCurrency } from '@/lib/utils';
interface ListingMarketSummaryProps { item: Record<string, unknown> | null; userId?: string; tenantId: string | null; nicheId: string; disabled: boolean; onApply: (price: number) => void; }
export default function ListingMarketSummary({ item, userId, tenantId, nicheId, disabled, onApply }: ListingMarketSummaryProps) {
  const market = useListingMarketValue(item, userId, tenantId, nicheId), data = market.result ?? savedMarketData(item);
  const pricing = itemPricing(item, null, data), music = savedMusicPrice(item), sold = asRecord(data.soldMarket), asking = asRecord(data.activeAskingPrices), valuation = asRecord(data.valuation);
  const suggestion = positiveMoney(music?.quick, pricing.suggested), estimate = positiveMoney(pricing.market, music?.market);
  const soldValue = Number(sold.verifiedSoldCount) > 0 ? positiveMoney(sold.medianPrice) : null;
  const askingValue = positiveMoney(asking.medianAskingPrice), busy = disabled || market.refresh.isPending;
  return <section className="swish-card space-y-4 p-4 sm:p-5" aria-label="Market evidence and recommended price">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp size={20} className="text-primary" />Market value &amp; suggested price</h2><button type="button" className="btn-secondary min-h-11" disabled={busy || !item} onClick={() => market.refresh.mutate()}><RefreshCw size={18} />{market.refresh.isPending ? 'Researching…' : 'Refresh research'}</button></header>
    <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]"><div><p className="text-muted-foreground">Market estimate</p><strong className="mt-2 block text-2xl">{estimate !== null ? formatCurrency(estimate) : 'Not available'}</strong>{pricing.low !== null && pricing.high !== null && <p className="mt-2 text-muted-foreground">Range: {formatCurrency(pricing.low)}–{formatCurrency(pricing.high)}</p>}</div><div className="rounded-xl border border-primary/30 bg-primary/10 p-4"><p>Suggested selling price</p><strong className="mt-2 block text-2xl text-primary">{suggestion !== null ? formatCurrency(suggestion) : 'Set your own price'}</strong>{suggestion !== null && <button type="button" className="btn-secondary mt-3 min-h-11" disabled={busy} onClick={() => onApply(suggestion)}><Check size={18} />Use {formatCurrency(suggestion)}</button>}</div></div>
    <p className="leading-7 text-muted-foreground">{soldValue !== null ? `Returned verified sold median: ${formatCurrency(soldValue)} (${String(sold.verifiedSoldCount)} sales).` : 'No verified sold evidence returned.'}{askingValue !== null ? ` Active asking median: ${formatCurrency(askingValue)} — not completed sales.` : ''} A market estimate is not a guaranteed sale price.</p>
    {typeof valuation.listingPriceRationale === 'string' && <p className="leading-7 text-muted-foreground">{valuation.listingPriceRationale}</p>}
    {Array.isArray(valuation.valuationWarnings) && valuation.valuationWarnings.length > 0 && <p className="leading-7 text-warning">{valuation.valuationWarnings.map(String).join(' · ')}</p>}
    {market.refresh.error && <p role="alert" className="flex items-start gap-2 text-destructive"><AlertCircle size={20} className="mt-1 shrink-0" />{market.refresh.error.message}</p>}
    <p className="text-sm leading-6 text-muted-foreground">Scan-filled title, category and specifics remain editable suggestions. Missing evidence stays unknown; confirm the physical condition and included parts.</p>
  </section>;
}
