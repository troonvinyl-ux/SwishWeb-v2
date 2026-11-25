import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { parseNumistaNumber } from '@/lib/numistaCapture';
import type { RapidMode } from '@/types/rapidCoin';
const measurement = z.string().refine(value => !value.trim() || Number.isFinite(Number(value)) && Number(value) > 0, 'Enter a positive measurement or leave it blank.');
const schema = z.object({ mode: z.enum(['standard', 'envelope']), weight: measurement, diameter: measurement, numista_number: z.string().refine(value => !value.trim() || Boolean(parseNumistaNumber(value)), 'Enter a valid Numista N# or URL.'), notes: z.string().max(2000), confirmed: z.boolean() }).refine(value => !value.numista_number.trim() || value.confirmed, { path: ['confirmed'], message: 'Confirm this reference against the actual coin, or leave it blank.' });
interface RapidCoinCaptureOptionsProps { mode: RapidMode; answers: Record<string, string>; locked: boolean; onApply: (mode: RapidMode, answers: Record<string, string>) => void; }
export default function RapidCoinCaptureOptions({ mode, answers, locked, onApply }: RapidCoinCaptureOptionsProps) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { mode, weight: answers.weight || '', diameter: answers.diameter || '', numista_number: answers.numista_number || '', notes: answers.notes || '', confirmed: Boolean(answers.numista_number) } });
  return <form className="space-y-3" onSubmit={form.handleSubmit(({ confirmed: _confirmed, mode: selected, ...values }) => onApply(selected, values))}>
    <div><label htmlFor="rapid-mode">Capture mode</label><select id="rapid-mode" disabled={locked} className="input-field mt-2" {...form.register('mode')}><option value="envelope">Collector's Envelope Mode</option><option value="standard">Standard identification</option></select></div>
    <div className="grid grid-cols-2 gap-3">{(['weight', 'diameter'] as const).map(key => <div key={key}><label htmlFor={`rapid-${key}`}>{key === 'weight' ? 'Weight (g, optional)' : 'Diameter (mm, optional)'}</label><input id={`rapid-${key}`} inputMode="decimal" className="input-field mt-2" {...form.register(key)} /></div>)}</div>
    <div><label htmlFor="rapid-numista">Seller-confirmed Numista N# (optional)</label><input id="rapid-numista" className="input-field mt-2" {...form.register('numista_number')} /></div>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" {...form.register('confirmed')} />I checked this catalogue reference against the actual coin.</label>
    <div><label htmlFor="rapid-notes">Catalogue references and seller notes</label><textarea id="rapid-notes" rows={3} className="input-field mt-2" {...form.register('notes')} /></div>
    {Object.values(form.formState.errors).map((error, i) => <p key={i} role="alert" className="flex items-center gap-2"><AlertCircle size={18} />{error.message}</p>)}
    <button type="submit" className="btn-secondary min-h-11">Apply capture details</button><p>Measurements are optional. Collector handwriting is evidence, not physical authentication.</p>
  </form>;
}
