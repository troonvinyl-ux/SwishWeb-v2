import ListingEditor from '@/pages/ListingEditor';
import RapidCoinEvidence from '@/components/features/RapidCoinEvidence';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface RapidCoinReviewProps { job: RapidCoinJob; approved: boolean; onNext: () => void; }
export default function RapidCoinReview({ job, approved, onNext }: RapidCoinReviewProps) {
  return <div className="min-w-0 space-y-4"><RapidCoinEvidence job={job} />{job.checkpoint.listingId ? <ListingEditor key={job.checkpoint.listingId} listingId={job.checkpoint.listingId} rapid={{ job, approved, onNext }} /> : <section className="swish-card space-y-3 p-5"><h2 className="text-xl font-semibold">Coin {job.sequence} · {job.processing.replace(/_/g, ' ')}</h2><p className="leading-7">{job.message}</p><p className="leading-7 text-muted-foreground">Your original photos and checkpoint are retained. Continue capturing while this coin prepares.</p><button type="button" className="btn-secondary" onClick={onNext}>Review next coin</button></section>}</div>;
}
