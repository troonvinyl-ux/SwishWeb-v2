import { rapidCoinPrices } from '@/lib/rapidCoinPricing';
import { formatCurrency } from '@/lib/utils';
interface RapidCoinPriceChoicesProps { item: Record<string, unknown> | null; disabled: boolean; onApply: (value: number) => void; }
export default function RapidCoinPriceChoices({ item, disabled, onApply }: RapidCoinPriceChoicesProps) {
  const price = rapidCoinPrices(item), options = [{ label: 'Market Price', value: price.market }, { label: 'Quick Sale', value: price.quick }, { label: 'SWISH Recommended', value: price.recommended }];
  return <section className="space-y-3 rounded-xl border border-border p-4"><h2 className="font-semibold">Choose your selling price</h2><div className="flex flex-wrap gap-2">{options.map(option => <button type="button" key={option.label} className="btn-secondary min-h-11" disabled={disabled || option.value === null} onClick={() => option.value !== null && onApply(option.value)}>{option.label}{option.value !== null && ` · ${formatCurrency(option.value)}`}</button>)}</div>
    <p className="text-base leading-7 text-muted-foreground">Or enter a manual price above. {price.low !== null && price.high !== null && `Market range ${formatCurrency(price.low)}–${formatCurrency(price.high)}. `}{price.quality}</p>
    <p className="text-base leading-7">{price.soldMedian !== null ? `Verified completed-sale median: ${formatCurrency(price.soldMedian)}.` : 'No verified completed-sale median available.'}{price.askingMedian !== null && ` Active asking median: ${formatCurrency(price.askingMedian)} — not realised sales.`}</p>
    {price.quick === null && <p className="text-sm text-muted-foreground">Quick Sale is unavailable until the shared engine returns a pricing ratio. No confidence discount is applied.</p>}
  </section>;
}
