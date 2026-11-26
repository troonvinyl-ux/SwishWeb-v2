import { AlertCircle, FileSearch } from 'lucide-react';
import { useRapidCoinPhotoPreviews } from '@/hooks/useRapidCoinPhotoPreviews';
import RapidCoinCorrection from '@/components/forms/RapidCoinCorrection';
import RapidCoinPhotoRoles from '@/components/features/RapidCoinPhotoRoles';
import type { RapidCoinJob } from '@/types/rapidCoin';
import { collectorEvidence } from '@/lib/rapidCoinPolicy';
interface RapidCoinEvidenceProps { job: RapidCoinJob; }
export default function RapidCoinEvidence({ job }: RapidCoinEvidenceProps) {
  const photos = useRapidCoinPhotoPreviews(job), envelope = photos.find(photo => photo.slotId === 'envelope');
  const retained = collectorEvidence(job.checkpoint.identification || {});
  const evidence = job.evidence?.transcriptionAvailable ? job.evidence : retained.transcriptionAvailable ? retained : job.evidence;
  return <details><summary className="flex items-center gap-2"><FileSearch size={20} />Identification evidence · {job.answers.numista_number ? 'Seller-confirmed catalogue lead' : evidence?.transcriptionAvailable ? 'Collector notes extracted' : 'Visual / unresolved'}</summary>
    <div className="mt-3 space-y-4"><p>{job.message}</p>{envelope && <a href={envelope.preview} target="_blank" rel="noopener noreferrer" className="block"><img src={envelope.preview} alt="Original collector envelope, internal identification evidence" className="max-h-80 w-full rounded-xl object-contain" /></a>}
      <h3 className="font-semibold">Original collector transcription</h3><p className="whitespace-pre-wrap leading-7">{evidence?.transcription || 'Transcription not returned. Read the original envelope and add seller-confirmed facts in the existing editor; no handwriting has been invented.'}</p>
      {job.answers.notes && <p className="whitespace-pre-wrap leading-7">Seller notes: {job.answers.notes}</p>}
      <dl className="space-y-3">{evidence?.fields.map((field, index) => <div key={`${field.name}:${index}`}><dt className="font-semibold">{field.name.replace(/_/g, ' ')} · <span className="text-primary">{field.source}</span></dt><dd className="leading-7">{field.value}{field.note && <p className="text-muted-foreground">{field.note}</p>}</dd></div>)}</dl>
      {evidence?.discrepancies.map((detail, index) => <p key={index} role="status" className="flex items-start gap-2 leading-7"><AlertCircle size={20} className="shrink-0" />{detail}</p>)}
      {!job.checkpoint.listingId && job.processing !== 'processing' && <RapidCoinPhotoRoles job={job} />}
      {job.checkpoint.itemId && <RapidCoinCorrection job={job} />}
      <p className="leading-7 text-muted-foreground">Catalogue and collector evidence are research leads, not proof of authenticity or metal. Exact-variety uncertainty alone does not establish a lower price. Envelope photos stay internal unless explicitly selected in Photos.</p>
    </div></details>;
}
