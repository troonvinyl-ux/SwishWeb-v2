import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { EbaySyncProgress } from '@/types/ebaySync';

interface EbaySyncStatusProps { busy: boolean; progress: EbaySyncProgress | null; error: string; }
export default function EbaySyncStatus({ busy, progress, error }: EbaySyncStatusProps) {
  if (!busy && !progress && !error) return null;
  return <section aria-label="eBay sync status" className="swish-card space-y-3 p-4">
    <p role="status" className="flex items-center gap-2 font-semibold">{error ? <AlertCircle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}{busy ? 'Syncing linked eBay listings in bounded batches' : error ? 'Sync incomplete — inspect unconfirmed listings' : 'Sync complete'}</p>
    {progress && <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Checked', progress.processed], ['Updated', progress.updated], ['Need attention', progress.failed > 0 ? progress.failed : error && progress.partial ? 'Unconfirmed' : 0], ['Images fetched', progress.imagesFetched]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}</dl>}
    {error && <p className="text-sm leading-6 text-muted-foreground">Completed listing readbacks remain saved. Counts reflect confirmed earlier batches and any partial counts returned by the shared service. An uncertain batch must be inspected before another sync; it has not been retried.</p>}
    {error && <p role="alert" className="flex items-start gap-2 leading-7 text-destructive"><AlertCircle className="mt-1 h-5 w-5 shrink-0" />{error}</p>}
    {progress && progress.issues.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View listing issues ({progress.issues.length})</summary><ul className="space-y-2">{progress.issues.slice(0, 50).map((issue, index) => <li key={`${issue.listingId || index}:${index}`} className="border-t border-border py-3 leading-7 text-muted-foreground">{issue.externalListingId ? `eBay ${issue.externalListingId}: ` : ''}{issue.message || issue.error || 'This listing could not be reconciled.'}{issue.code ? ` (eBay ${issue.code})` : ''}</li>)}</ul></details>}
    <p className="text-sm leading-6 text-muted-foreground">Uses the app’s existing eBay service. Unconfirmed requests are not automatically repeated; completed records and original photos are retained.</p>
  </section>;
}
