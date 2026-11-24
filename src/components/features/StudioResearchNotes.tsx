import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink } from 'lucide-react';
import type { SwishNicheId } from '@/lib/niche';
interface StudioResearchNotesProps { niche: SwishNicheId | null; notes: string; onNotes: (notes: string) => void; }
const schema = z.object({ notes: z.string().max(2000, 'Keep notes under 2,000 characters.') });
export default function StudioResearchNotes({ niche, notes, onNotes }: StudioResearchNotesProps) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { notes } });
  return <form onSubmit={form.handleSubmit(values => onNotes(values.notes))} className="space-y-4"><h3 className="font-semibold">{niche === 'coins' ? 'Numista first · then physical checks' : niche === 'tunes_flip' ? 'Discogs first · then physical contents' : 'Identifiers, barcode and seller notes'}</h3><p>Catalogue selection and enrichment continue in your existing specialist review. Seller-confirmed references are not replaced by camera guesses.</p>{(niche === 'coins' || niche === 'tunes_flip') && <a href={niche === 'coins' ? 'https://en.numista.com/catalogue/' : 'https://www.discogs.com/search/'} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 underline"><ExternalLink size={18} />Open {niche === 'coins' ? 'Numista' : 'Discogs'} catalogue</a>}<div><label htmlFor="studio-seller-notes">Seller notes, measurements and corrections</label><textarea id="studio-seller-notes" rows={3} className="input-field mt-2" {...form.register('notes')} /></div>{form.formState.errors.notes && <p role="alert">{form.formState.errors.notes.message}</p>}<button type="submit" className="btn-secondary">Apply notes</button><p>Camera session recovery is memory-only for up to two hours. Closing this tab loses unsaved photos; logout or account switching clears them.</p></form>;
}
