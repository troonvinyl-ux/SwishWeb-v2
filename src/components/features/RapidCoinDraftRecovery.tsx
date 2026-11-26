import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useRapidDraftRecovery } from '@/hooks/useRapidDraftRecovery';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface RapidCoinDraftRecoveryProps { job: RapidCoinJob; }
export default function RapidCoinDraftRecovery({ job }: RapidCoinDraftRecoveryProps) {
  const recovery = useRapidDraftRecovery(job);
  if (job.checkpoint.listingId || job.processing !== 'needs_attention' || !job.checkpoint.itemId) return null;
  return <section className="swish-card space-y-4 p-5" aria-labelledby="rapid-draft-recovery-title">
    <h2 id="rapid-draft-recovery-title" className="flex items-center gap-2 text-xl font-semibold"><AlertCircle size={22} className="shrink-0 text-warning"/>Recover this coin’s draft</h2>
    <p className="text-base leading-7">Your original coin and photographs are saved. Check the existing draft before continuing; this action does not submit to eBay.</p>
    {job.checkpoint.draftFailure && <p className="text-base leading-7 text-muted-foreground">{job.checkpoint.draftFailure.outcome === 'rejected' ? 'Backend rejected the draft save' : 'Draft response unconfirmed'}: {job.checkpoint.draftFailure.message}</p>}
    <button type="button" className="btn-primary min-h-11" disabled={recovery.busy || job.publication !== 'none'} onClick={() => void recovery.check()}><RefreshCw size={20}/>{recovery.busy ? 'Checking original draft…' : 'Check saved draft / resume'}</button>
    <Link className="btn-secondary min-h-11" to={`/inventory/${job.checkpoint.itemId}`}>Open original inventory item</Link>
    {recovery.message && <p role="status" className="text-base leading-7">{recovery.message}</p>}
  </section>;
}
