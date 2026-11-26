import { ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import { useRapidDraftRecovery } from '@/hooks/useRapidDraftRecovery';
import { rapidCanPublish, rapidJobStatus } from '@/types/rapidCoin';
import { formatCurrency } from '@/lib/utils';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface RapidCoinQueueCardProps { job: RapidCoinJob; selected: boolean; onSelect: () => void; onReview: () => void; }
export default function RapidCoinQueueCard({ job, selected, onSelect, onReview }: RapidCoinQueueCardProps) {
  const recovery = useRapidDraftRecovery(job), needsDraftCheck = Boolean(job.checkpoint.draftAttempted && !job.checkpoint.listingId);
  const candidateTitle = typeof job.checkpoint.identification?.canonicalTitle === 'string' ? job.checkpoint.identification.canonicalTitle : '';
  const photo = job.draft?.photos[0] || job.checkpoint.photos?.obverse;
  const evidenceLabel = job.answers.numista_number ? `Seller-supplied ${job.answers.numista_number}` : job.evidence?.transcriptionAvailable ? 'Collector-labelled lead · verify against coin' : 'Photo identification · Numista number optional';
  const resume = () => needsDraftCheck ? recovery.check() : changeRapidJob(job.id, job.scope, current => {
    if (current.processing !== 'needs_attention' || current.publication !== 'none' || current.lease) throw new Error('The capture changed. Refresh its saved status before retrying.');
    return { ...current, processing: 'captured', enqueued: true, message: 'Retrying preparation on the original capture and inventory ID.' };
  }).catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Retry could not be saved.'));
  return <article className="rapid-queue-card">
    <label className="rapid-select"><input type="checkbox" checked={selected} disabled={!rapidCanPublish(job)} onChange={onSelect} aria-label={`Approve coin ${job.sequence} for batch review`} /></label>
    <button type="button" className="rapid-queue-open" onClick={onReview}>
      {photo ? <img src={photo} alt={`Coin ${job.sequence} obverse`} loading="lazy" /> : <span className="rapid-number">{job.sequence}</span>}
      <span className="min-w-0 flex-1"><strong>{job.draft?.title || candidateTitle || `Coin ${job.sequence}`}</strong><span className="rapid-state">{rapidJobStatus(job)}{job.deferred ? ' · Review later' : ''}</span><small>{evidenceLabel}</small></span>
      <span className="rapid-price">{job.draft?.price ? formatCurrency(job.draft.price) : 'Price pending'}</span><ChevronRight size={18} />
    </button>
    {(job.processing === 'needs_attention' || Boolean(job.evidence?.discrepancies.length)) && <p className="rapid-message"><AlertCircle size={18} />{job.message}</p>}
    {job.processing === 'needs_attention' && job.publication === 'none' && <button type="button" className="btn-secondary min-h-11" disabled={recovery.busy} onClick={() => void resume()}><RefreshCw size={18} />{recovery.busy ? 'Checking original draft…' : needsDraftCheck ? 'Check saved draft / resume' : 'Retry same capture'}</button>}
    {recovery.message && <p role="status" className="rapid-message">{recovery.message}</p>}
  </article>;
}
