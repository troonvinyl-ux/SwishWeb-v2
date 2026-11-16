import { AlertCircle, CheckCircle2, ClipboardCheck, HelpCircle } from 'lucide-react';
import type { ReadinessCheck } from '@/types/listingReadiness';
interface ListingReadinessProps { checks: ReadinessCheck[]; }
export default function ListingReadiness({ checks }: ListingReadinessProps) {
  const failures = checks.filter(check => check.status === 'fail').length;
  return <section className="swish-card overflow-hidden" aria-labelledby="draft-readiness-title">
    <header className="border-b border-border bg-primary/5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="draft-readiness-title" className="flex items-center gap-2 text-lg font-semibold"><ClipboardCheck className="h-5 w-5 text-primary" />Draft readiness</h2><span className="text-sm font-medium text-muted-foreground">{failures ? `${failures} local issues` : 'Local checks complete'}</span></div><p className="mt-2 text-base leading-7 text-muted-foreground">Prepare your saved draft, then run advisory verification. Live category, condition, specifics and publication acceptance remain separate marketplace checks.</p></header>
    <ul className="grid gap-x-6 px-5 lg:grid-cols-2">{checks.map(check => {
      const Icon = check.status === 'pass' ? CheckCircle2 : check.status === 'fail' ? AlertCircle : HelpCircle;
      const tone = check.status === 'pass' ? 'text-success' : check.status === 'fail' ? 'text-destructive' : 'text-warning';
      return <li key={check.id} className="flex gap-3 border-b border-border py-4"><Icon className={`mt-1 h-5 w-5 shrink-0 ${tone}`} /><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{check.label}</h3><span className={`text-sm ${tone}`}>{check.status === 'pass' ? 'Local pass' : check.status === 'fail' ? 'Needs attention' : 'Review required'}</span></div><p className="mt-1 text-base leading-7 text-muted-foreground">{check.detail}</p></div></li>;
    })}</ul>
    <p className="p-5 text-sm leading-6 text-muted-foreground">This checklist makes no API calls, does not grant access and never publishes automatically. A passed advisory verification is not an eBay acceptance.</p>
  </section>;
}
