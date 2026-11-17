import type { UseFormReturn } from 'react-hook-form';
import type { CaptureField } from '@/types/capture';
interface CaptureObservationsProps { fields: CaptureField[]; form: UseFormReturn<Record<string, string>>; disabled: boolean; nicheId: string; }
export default function CaptureObservations({ fields, form, disabled, nicheId }: CaptureObservationsProps) {
  return <section aria-label="Measurements and observations"><h2 className="text-lg font-semibold">Measurements and observations</h2><fieldset disabled={disabled} className="mt-4 space-y-4">
    <p className="leading-7 text-muted-foreground">Optional seller observations are cross-checked against photos, not treated as independent certification.</p>
    {nicheId === 'stamps' && <p className="rounded-lg border border-primary/30 bg-primary/10 p-4 leading-7">Keep sets, blocks, covers and album pages intact. Unused does not prove MNH. Record gum only after safely inspecting the reverse; catalogue numbers remain claims until checked.</p>}
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <div key={field.key}><label htmlFor={`observation-${field.key}`} className="mb-2 block">{field.label}</label><input id={`observation-${field.key}`} className="input-field min-h-11" {...form.register(field.key)} /></div>)}</div>
    <label htmlFor="capture-notes" className="block">Additional observations / provenance</label><textarea id="capture-notes" rows={3} className="input-field" {...form.register('notes')} />
  </fieldset></section>;
}
