import { ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import { rapidCanPublish, rapidJobStatus } from '@/types/rapidCoin';
import { formatCurrency } from '@/lib/utils';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface RapidCoinQueueCardProps { job: RapidCoinJob; selected: boolean; onSelect: () => void; onReview: () => void; }
export default function RapidCoinQueueCard({ job, selected, onSelect, onReview }: RapidCoinQueueCardProps) {
  const resume = () => changeRapidJob(job.id, job.scope, current => ({ ...current, processing: 'captured', enqueued: true, message: 'Retrying preparation on the original capture and inventory ID.' })).catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Retry could not be saved.'));
  return <article className="rapid-queue-card">
    <label className="rapid-select"><input type="checkbox" checked={selected} disabled={!rapidCanPublish(job)} onChange={onSelect} aria-label={`Approve coin ${job.sequence} for batch review`} /></label>
    <button type="button" className="rapid-queue-open" onClick={onReview}>
      {job.draft?.photos[0] ? <img src={job.draft.photos[0]} alt={`Coin ${job.sequence} obverse`} loading="lazy" /> : <span className="rapid-number">{job.sequence}</span>}
      <span className="min-w-0 flex-1"><strong>{job.draft?.title || `Coin ${job.sequence}`}</strong><span className="rapid-state">{rapidJobStatus(job)}{job.deferred ? ' · Review later' : ''}</span><small>{job.answers.numista_number || 'No seller-confirmed Numista reference'}</small></span>
      <span className="rapid-price">{job.draft?.price ? formatCurrency(job.draft.price) : 'Price pending'}</span><ChevronRight size={18} />
    </button>
    {(job.processing === 'needs_attention' || job.evidence?.discrepancies.length) && <p className="rapid-message"><AlertCircle size={18} />{job.message}</p>}
    {job.processing === 'needs_attention' && job.publication === 'none' && <button type="button" className="btn-secondary min-h-11" onClick={() => void resume()}><RefreshCw size={18} />Retry same capture</button>}
  </article>;
}
