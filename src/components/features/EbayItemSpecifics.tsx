import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import type { EbayAspect } from '@/lib/ebayMusicContract';
import { listingSpecifics } from '@/lib/listingEditorData';

interface EbayItemSpecificsProps {
  categoryId: string;
  aspects: EbayAspect[];
  value: unknown;
  disabled: boolean;
  onChanged: (value: Record<string, string>) => void;
}

/** Current eBay metadata controls both suggested values and which specifics are required. */
export default function EbayItemSpecifics({ categoryId, aspects, value, disabled, onChanged }: EbayItemSpecificsProps) {
  const [optional, setOptional] = useState(false);
  const specifics = listingSpecifics(value);
  if (!categoryId) return <section className="swish-card p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><ListChecks size={20} className="text-primary" />Item specifics</h2><p className="mt-2 leading-7 text-muted-foreground">Choose an eBay category to load its current required item specifics. SWISH never fills these with guesses.</p></section>;
  if (!aspects.length) return <section className="swish-card p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><ListChecks size={20} className="text-primary" />Item specifics</h2><p className="mt-2 leading-7 text-muted-foreground">Current eBay item-specific rules are unavailable. The saved evidence is retained; retry the category lookup before submission.</p></section>;

  const known = new Map(aspects.map(aspect => [aspect.name.toLowerCase(), aspect]));
  const rows = [...aspects, ...Object.keys(specifics).filter(name => !known.has(name.toLowerCase())).map(name => ({ name, values: [], selectionOnly: false, required: false }))];
  const missing = aspects.filter(aspect => aspect.required && !specifics[aspect.name]);
  const change = (name: string, next: string) => {
    const updated = { ...specifics };
    if (next.trim()) updated[name] = next.trim().slice(0, 65);
    else delete updated[name];
    onChanged(updated);
  };
  return <section className="swish-card space-y-4 p-4 sm:p-5"><header><h2 className="flex items-center gap-2 text-lg font-semibold"><ListChecks size={20} className="text-primary" />eBay item specifics</h2><p className="mt-2 leading-7 text-muted-foreground">Values suggested from your scan are carried forward only when they match eBay’s current category rules. Confirm every value against the physical item.</p></header>
    {missing.length > 0 && <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground">Still needed for this eBay category: {missing.map(aspect => aspect.name).join(', ')}.</p>}
    <div className="flex gap-2"><button type="button" className={optional ? "btn-secondary" : "btn-primary"} onClick={() => setOptional(false)}>Required</button><button type="button" className={optional ? "btn-primary" : "btn-secondary"} onClick={() => setOptional(true)}>Optional</button></div><fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2"><legend className="sr-only">eBay item specifics</legend>{rows.filter(aspect => optional ? !aspect.required : aspect.required).map(aspect => {
      const current = specifics[aspect.name] || '';
      return <div key={aspect.name}><label htmlFor={`specific-${aspect.name}`} className="mb-2 block">{aspect.name}{aspect.required ? ' *' : ''}</label>{aspect.selectionOnly ? <select id={`specific-${aspect.name}`} value={current} onChange={event => change(aspect.name, event.target.value)} className="input-field min-h-11"><option value="">Choose a value</option>{current && !aspect.values.some(option => option === current) && <option value={current}>{current} (saved)</option>}{aspect.values.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input id={`specific-${aspect.name}`} value={current} maxLength={65} onChange={event => change(aspect.name, event.target.value)} className="input-field min-h-11" placeholder={aspect.required ? 'Required by this eBay category' : 'Not set'} />}</div>})}</fieldset>
    <p className="text-sm leading-6 text-muted-foreground">* Required by the current eBay category. Final marketplace validation happens only when you submit.</p>
  </section>;
}
