import { Zap, AlertTriangle } from 'lucide-react';
import { displayValue } from '@/lib/itemPricing';
import { savedIdentification, normalizeIdentification, identificationLines } from '@/lib/identificationResult';
import IdentificationDetails from '@/components/features/IdentificationDetails';
import { getSpecialistIdsForNiche } from '@/lib/niche';
interface ItemReidentifyReviewProps { item: Record<string, unknown> | null; candidate: Record<string, unknown> | null; busy: boolean; saving: boolean; onIdentify: () => void; onApply: () => void; onDismiss: () => void; }
export default function ItemReidentifyReview({ item, candidate, busy, saving, onIdentify, onApply, onDismiss }: ItemReidentifyReviewProps) {
  const stored = savedIdentification(item), research = candidate ? normalizeIdentification(candidate) : stored;
  const coin = getSpecialistIdsForNiche('coins').includes(String(item?.specialist_id));
  const confidence = candidate ? research.confidence : item?.identification_confidence ?? stored.confidence;
  const evidence = identificationLines(research.evidence);
  const warnings = [...new Set([...identificationLines(research.warnings), ...identificationLines(research.contradictions), ...(!candidate ? identificationLines(item?.warnings) : [])])];
  const missing = identificationLines(research.missingInformation);
  return <section className="swish-card p-5 space-y-5">
    <div><h2 className="text-lg font-semibold">Re-identify</h2><p className="mt-2 text-muted-foreground leading-relaxed">Research uses your original photographs and actual measurements, not a generated reference or cutout. Review any new suggestion before applying it.</p></div>
    <button type="button" disabled={!item || busy || saving} className="btn-secondary" onClick={onIdentify}><Zap className="h-4 w-4" />{busy ? 'Identifying…' : 'Re-ID from original photos'}</button>
    {!candidate && confidence != null && Number(confidence) > 0 && <p className="text-muted-foreground">Saved identification confidence: {Math.round(Math.max(0, Math.min(1, Number(confidence))) * 100)}%</p>}
    {candidate && <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-4"><span className="text-sm text-primary font-semibold">Suggestion — not saved</span><h3 className="text-xl font-semibold">{displayValue(research.title)}</h3>{typeof confidence === 'number' && <p className="text-sm text-muted-foreground">Identification confidence: {Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%</p>}<IdentificationDetails candidate={research} showUnknown={coin} /><div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={saving || busy} onClick={onApply}>{saving ? 'Saving…' : 'Apply reviewed details'}</button><button type="button" className="btn-secondary" disabled={saving} onClick={onDismiss}>Dismiss</button></div><p className="text-sm text-muted-foreground leading-relaxed">Applies the supported title, identity fields, description and evidence to inventory. Unknown fields do not erase existing details. Actual measurements, photos, prices and eBay remain unchanged.</p></div>}
    {!candidate && Boolean(stored.title) && <IdentificationDetails candidate={stored} showUnknown={coin} />}
    {evidence.length > 0 && <div><h3 className="font-semibold mb-2">Supporting evidence</h3><ul className="space-y-2 text-muted-foreground">{evidence.map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
    {missing.length > 0 && <div><h3 className="font-semibold mb-2">Still needed for attribution</h3><ul className="space-y-2 text-muted-foreground">{missing.map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
    {warnings.length > 0 && <div className="flex items-start gap-3 text-warning"><AlertTriangle className="h-5 w-5 shrink-0 mt-1" /><p className="leading-relaxed">{warnings.join(' · ')}</p></div>}
  </section>;
}
