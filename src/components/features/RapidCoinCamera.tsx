import { toast } from 'sonner';
import { useRapidCoinCapture } from '@/hooks/useRapidCoinCapture';
import { useRapidCoinPhotoPreviews } from '@/hooks/useRapidCoinPhotoPreviews';
import { useRapidCoins } from '@/contexts/RapidCoinContext';
import SharedCaptureCamera from '@/components/features/SharedCaptureCamera';
import RapidCoinCaptureOptions from '@/components/forms/RapidCoinCaptureOptions';
interface RapidCoinCameraProps { batchId: string; mode: 'standard' | 'envelope'; onClose: () => void; }
export default function RapidCoinCamera({ batchId, mode, onClose }: RapidCoinCameraProps) {
  const capture = useRapidCoinCapture(batchId, mode), queue = useRapidCoins(), photos = useRapidCoinPhotoPreviews(capture.job);
  const queued = queue.jobs.filter(job => job.batchId === batchId && job.enqueued).length;
  return <SharedCaptureCamera autoStart coin disabled={!queue.ready} label={capture.label} guidance={capture.label}
    detail={capture.job && capture.job.photos.length >= 3 && !capture.hold ? 'Queued automatically in 2.5 seconds. Choose Add more evidence to keep this coin open.' : 'Obverse → reverse → envelope. Originals are retained on this device before the next coin.'}
    photos={photos} canReview={photos.length >= 2} onPhoto={file => capture.add([file])} onImport={capture.add}
    onDone={() => void capture.enqueue().catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Could not queue this coin.'))} onClose={onClose}
    selector={<span className="flex flex-wrap gap-2"><button type="button" className="studio-niche-pill" disabled={capture.saving} aria-pressed={capture.hold} onClick={() => capture.setHold(!capture.hold)}>{capture.hold ? 'Auto queue paused' : 'Add more evidence'}</button><button type="button" className="studio-niche-pill" onClick={onClose}>{queued} queued · Review</button></span>}
    tools={<><button type="button" className="btn-secondary min-h-11 w-full" aria-pressed={capture.hold} onClick={() => capture.setHold(!capture.hold)}>{capture.hold ? 'Resume auto queue' : 'Add more evidence · Pause auto queue'}</button>
      <RapidCoinCaptureOptions key={capture.job?.id || 'next'} mode={capture.job?.mode || mode} answers={capture.job?.answers || {}} locked={Boolean(photos.length)} onApply={(mode, answers) => void capture.configure(mode, answers).catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Capture details were not saved.'))} />
      {queue.error && <p role="alert">{queue.error}</p>}<p>Queued work continues while this coin stays in the camera. Keep this browser open for background processing; refresh resumes saved work.</p></>} />;
}
