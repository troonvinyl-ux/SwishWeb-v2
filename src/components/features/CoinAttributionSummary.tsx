import { Coins } from 'lucide-react';
import { coinAttribution, COIN_FACT_LABELS } from '@/lib/coinAttribution';
import { COIN_FACT_KEYS } from '@/lib/coinFactNormalization';
interface CoinAttributionSummaryProps { attributes: Record<string, unknown>; title: string; }
export default function CoinAttributionSummary({ attributes, title }: CoinAttributionSummaryProps) {
  const attribution = coinAttribution(attributes, title);
  if (!Object.keys(attribution.facts).length) return null;
  const sources = { recorded: 'Recorded attribution · review', visual: 'Coin photo observation', collector: 'Collector note · previously attributed', title: 'Identification title · review' };
  return <div className="space-y-4">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Coins size={20} className="text-primary"/>Assembled coin attribution</h2>
    <p className="text-base font-semibold" role="status">{attribution.status === 'corroborated' ? 'Attribution corroborated · coin and note agree' : 'Provisional attribution · available details retained'}</p>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{COIN_FACT_KEYS.map(key => attribution.facts[key] && <div key={key}><dt className="text-base text-muted-foreground">{COIN_FACT_LABELS[key]}</dt><dd className="mt-1 break-words text-lg font-semibold">{attribution.facts[key]!.value}</dd><dd className="mt-1 text-base leading-6 text-muted-foreground">{attribution.agreements.includes(key) ? 'Coin and collector note agree' : sources[attribution.facts[key]!.source]}</dd></div>)}</dl>
    {attribution.conflicts.map(detail => <p key={detail} role="status" className="text-base leading-7 text-warning">Evidence discrepancy: {detail}</p>)}
    <p className="text-base leading-7 text-muted-foreground">The category describes the coin’s issuing country and period; it does not require every attribution field to be verified. Note-only details remain usable as previously attributed. Corroboration is not authentication or a metal test.</p>
  </div>;
}
