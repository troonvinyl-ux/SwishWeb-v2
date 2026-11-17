import { Zap, AlertTriangle } from 'lucide-react';
import { displayValue } from '@/lib/itemPricing';
import { asRecord } from '@/lib/itemPhotos';
interface ItemReidentifyReviewProps { item: Record<string, unknown> | null; candidate: Record<string, unknown> | null; busy: boolean; saving: boolean; onIdentify: () => void; onApply: () => void; onDismiss: () => void; }
export default function ItemReidentifyReview({ item, candidate, busy, saving, onIdentify, onApply, onDismiss }: ItemReidentifyReviewProps) {
  const attrs = asRecord(item?.attributes), source = asRecord(attrs.source_scan), stored = asRecord(source.confirmed_candidate ?? item?.identification_data);
  const confidence = item?.identification_confidence ?? stored.confidence;
  const evidence = candidate?.evidenceSupporting ?? candidate?.evidence ?? stored.evidence;
  const warnings = candidate?.warnings ?? candidate?.contradictions ?? item?.warnings;
  const lines = (value: unknown) => Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : typeof value === 'string' ? [value] : [];
  return <section className="swish-card p-5 space-y-5">
    <div><h2 className="text-lg font-semibold">Re-identify</h2><p className="mt-2 text-muted-foreground leading-relaxed">Research uses your original photographs and actual measurements, not a generated reference or cutout. Review any new suggestion before applying it.</p></div>
    <button type="button" disabled={!item || busy || saving} className="btn-secondary" onClick={onIdentify}><Zap className="h-4 w-4" />{busy ? 'Identifying…' : 'Re-ID from original photos'}</button>
    {!candidate && confidence != null && Number(confidence) > 0 && <p className="text-muted-foreground">Saved identification confidence: {Math.round(Math.max(0, Math.min(1, Number(confidence))) * 100)}%</p>}
    {candidate && <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3"><span className="text-sm text-primary font-semibold">Suggestion — not saved</span><h3 className="text-xl font-semibold">{displayValue(candidate.canonicalTitle || candidate.title || candidate.name)}</h3><div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={saving || busy} onClick={onApply}>{saving ? 'Saving…' : 'Apply reviewed title'}</button><button type="button" className="btn-secondary" disabled={saving} onClick={onDismiss}>Dismiss</button></div><p className="text-sm text-muted-foreground">Only the inventory title is updated. Attributes, photographs, prices and eBay remain unchanged.</p></div>}
    {lines(evidence).length > 0 && <div><h3 className="font-semibold mb-2">Supporting evidence</h3><ul className="space-y-2 text-muted-foreground">{lines(evidence).map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
    {lines(warnings).length > 0 && <div className="flex items-start gap-3 text-warning"><AlertTriangle className="h-5 w-5 shrink-0 mt-1" /><p className="leading-relaxed">{lines(warnings).join(' · ')}</p></div>}
  </section>;
}
