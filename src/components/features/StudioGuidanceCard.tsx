import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
interface StudioGuidanceCardProps { instruction: string; detail: string; processing: boolean; }
export default function StudioGuidanceCard({ instruction, detail, processing }: StudioGuidanceCardProps) {
  const [expanded, setExpanded] = useState(true);
  return <section className="studio-guidance" aria-label="Next photo guidance"><div className="studio-guidance-copy"><p>{instruction}</p>{expanded && detail && <p className="studio-detail">{detail}</p>}{processing && <span className="studio-processing" role="status">Checking evidence · camera stays available</span>}</div><button type="button" className="studio-icon" aria-label={expanded ? 'Minimise guidance' : 'Expand guidance'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}</button></section>;
}
