import { FileSearch } from 'lucide-react';
import { useCollectorEnvelopeReread } from '@/hooks/useCollectorEnvelopeReread';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface CollectorEnvelopeRereadProps { job: RapidCoinJob; }
export default function CollectorEnvelopeReread({ job }: CollectorEnvelopeRereadProps) {
  const read = useCollectorEnvelopeReread(job);
  if (!job.photos.some(photo => photo.slotId === 'envelope')) return null;
  const disabled = read.busy || job.processing === 'processing' || !job.checkpoint.photos?.envelope || job.publication !== 'none' || Boolean(job.externalId || job.publicationAttempt);
  return <div className="space-y-2"><button type="button" className="btn-secondary min-h-11" disabled={disabled} onClick={() => void read.reread()}><FileSearch size={18} />{read.busy ? 'Reading original envelope…' : 'Read envelope again'}</button>
    <p className="text-muted-foreground leading-7">Uses the saved envelope and both coin faces in the shared SWISH identification engine. A Numista number is optional; handwriting stays collector-labelled, not verified identity.</p>
    {job.checkpoint.envelopeReadError && <p role="status" className="leading-7">{job.checkpoint.envelopeReadError}</p>}
  </div>;
}
