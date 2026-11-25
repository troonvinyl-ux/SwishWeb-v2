import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import './studioGuidance.css';
interface StudioGuidanceCardProps { instruction: string; detail: string; processing: boolean; }
export default function StudioGuidanceCard({ instruction, detail, processing }: StudioGuidanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [instruction]);
  const friendly = instruction.replace(/Start with the whole obverse of your coin\.?/i, 'Photograph the front of your coin.').replace(/\bobverse\b/gi, 'front').replace(/\breverse\b/gi, 'back');
  return <section className="studio-guidance swish-compact-guidance" aria-label="Next photo guidance" data-expanded={expanded}>
    <Sparkles size={19} className="swish-guidance-sparkle" aria-hidden="true"/>
    <div className="studio-guidance-copy" aria-live="polite">
      <p className="swish-guidance-instruction">{friendly}</p>
      {expanded && detail && <p className="studio-detail">{detail}</p>}
      {expanded && processing && <span className="studio-processing" role="status">Checking your photos…</span>}
    </div>
    <button type="button" className="studio-icon" aria-label={expanded ? 'Minimise guidance' : 'Expand guidance'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
  </section>;
}
