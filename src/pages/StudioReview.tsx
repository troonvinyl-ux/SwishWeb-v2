import { useParams } from 'react-router-dom';
import { normaliseNicheId } from '@/lib/niche';
import QuickCaptureWorkspace from '@/components/features/QuickCaptureWorkspace';
import NotFound from '@/pages/NotFound';
export default function StudioReview() { const { niche } = useParams(), selected = normaliseNicheId(niche); return selected ? <QuickCaptureWorkspace key={selected} nicheId={selected} /> : <NotFound />; }
