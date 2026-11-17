import { formatCurrency } from '@/lib/utils';
import { itemPricing } from '@/lib/itemPricing';
interface ItemPricingSummaryProps { item: Record<string, unknown> | null; listing?: Record<string, unknown> | null; market?: Record<string, unknown> | null; }
export default function ItemPricingSummary({ item, listing, market }: ItemPricingSummaryProps) {
  const pricing = itemPricing(item, listing, market);
  const tiles = [
    { label: 'Market value', value: pricing.market, note: 'SWISH evidence-led estimate' },
    { label: 'Suggested listing price', value: pricing.suggested, note: 'Recommendation, not your eBay price' },
    { label: 'Actual listing price', value: pricing.actual, note: listing ? 'Saved marketplace listing' : 'No marketplace listing selected' },
  ];
  return <section className="swish-card p-5 space-y-4" aria-label="Pricing overview">
    <h2 className="text-lg font-semibold">Pricing</h2>
    <div className="item-pricing-grid">{tiles.map(tile => <div key={tile.label} className="item-price-tile">
      <span className="text-sm text-muted-foreground">{tile.label}</span><strong className="text-2xl text-primary">{tile.value === null ? 'Not set' : formatCurrency(tile.value)}</strong><p className="text-sm text-muted-foreground leading-relaxed">{tile.note}</p>
    </div>)}</div>
    <p className="text-sm text-muted-foreground">Acquisition cost: {pricing.cost === null ? 'Not recorded' : formatCurrency(pricing.cost)}. Updating SWISH research does not change a live eBay price.</p>
  </section>;
}
