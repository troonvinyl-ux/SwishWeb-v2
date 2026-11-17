import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assertCaptureScope } from '@/lib/captureRequest';
import type { CaptureDraft, CaptureScope } from '@/types/capture';
import { toast } from 'sonner';
import NumistaCaptureReview from '@/components/features/NumistaCaptureReview';
const schema = z.object({ title: z.string().trim().min(1, 'Enter an item title.').max(80, 'Use no more than 80 characters.'), description: z.string(), price: z.string().refine(value => !value || (Number.isFinite(Number(value)) && Number(value) > 0), 'Enter a positive selling price or leave it blank for later.'), reviewed: z.boolean() });
interface CaptureDraftReviewProps { draft: CaptureDraft; scope: CaptureScope; }
export default function CaptureDraftReview({ draft, scope }: CaptureDraftReviewProps) {
  const navigate = useNavigate(), qc = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { title: draft.title, description: draft.description, price: draft.price && draft.price > 0 ? String(draft.price) : '', reviewed: false } });
  const save = (list: boolean) => form.handleSubmit(async values => {
    if (busy) return;
    if (list && (!values.reviewed || !values.price)) { toast.error('Review identity, condition and price before continuing to publication.'); return; }
    setBusy(true); setError('');
    await assertCaptureScope(scope).then(async () => {
      const observed = await scope.client.from('listings').select('status,external_listing_id,publish_claim_id').eq('id', draft.listingId).eq('tenant_id', scope.tenantId).single();
      if (observed.error || !observed.data) throw new Error('Saved draft could not be checked. Retry this saved listing, not a new submission.');
      if (observed.data.external_listing_id || observed.data.publish_claim_id || ['active', 'live'].includes(String(observed.data.status))) throw new Error('This listing already has a submission. Inspect it instead of publishing again.');
      await assertCaptureScope(scope);
      const saved = await scope.client.from('listings').update({ title: values.title, description: values.description, price: values.price ? Number(values.price) : null }).eq('id', draft.listingId).eq('tenant_id', scope.tenantId).eq('status', observed.data.status).is('external_listing_id', null).is('publish_claim_id', null).select('id').single();
      if (saved.error || !saved.data) throw new Error(saved.error?.message ?? 'Draft changes were not confirmed.');
      await assertCaptureScope(scope); await Promise.all(['items', 'listings'].map(table => qc.invalidateQueries({ queryKey: [table] })));
      toast.success(list ? 'Draft saved. Complete marketplace checks before publishing.' : 'Saved for later in your draft inventory.');
      navigate(list ? `/listings/${draft.listingId}` : '/inventory?tab=draft');
    }).catch((cause: unknown) => { const message = cause instanceof Error ? cause.message : 'Draft save unavailable.'; setError(message); toast.error(message); }).finally(() => setBusy(false));
  });
  return <section className="space-y-4" aria-label="Ready to list review"><NumistaCaptureReview reference={draft.numistaReference} research={draft.numistaResearch} /><div className="swish-card space-y-4 p-4 sm:p-6"><h2 className="text-xl font-semibold">Ready to list · review your draft</h2><p className="leading-7 text-muted-foreground">Your item and original photos are saved. Check the identity, edition, condition, description and price; this is not yet live on eBay.</p><div className="flex gap-3 overflow-x-auto">{draft.photos.map((photo, index) => <img key={photo} src={photo} alt={`Original evidence ${index + 1}`} className="h-28 w-28 shrink-0 rounded-lg border border-border object-contain" />)}</div>
    <fieldset disabled={busy} className="space-y-4"><div><label htmlFor="ready-title" className="mb-2 block">Listing title</label><input id="ready-title" className="input-field min-h-11" {...form.register('title')} /></div><div><label htmlFor="ready-price" className="mb-2 block">Selling price (£)</label><input id="ready-price" type="number" step="0.01" min="0" className="input-field min-h-11" {...form.register('price')} /><p className="mt-2 text-sm text-muted-foreground">Set your price. Identification and catalogue values are not realised sales.</p></div><div><label htmlFor="ready-description" className="mb-2 block">Description and condition / faults</label><textarea id="ready-description" rows={7} className="input-field leading-7" {...form.register('description')} /></div><label className="flex min-h-11 items-start gap-3 leading-7"><input type="checkbox" className="mt-2 h-5 w-5" {...form.register('reviewed')} />I have checked the physical identity, condition, contents and every listing claim.</label></fieldset>
    {Object.entries(form.formState.errors).map(([key, value]) => <p key={key} role="alert" className="flex items-center gap-2 text-destructive"><AlertCircle className="h-5 w-5" />{value.message}</p>)}{error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button type="button" className="min-h-11" disabled={busy} onClick={() => void save(true)()}><ArrowRight className="mr-2 h-4 w-4" />{busy ? 'Saving…' : 'List'}</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void save(false)()}><Save className="mr-2 h-4 w-4" />Save for later</Button><Link to={`/inventory/${draft.itemId}`} className="btn-ghost min-h-11">View saved item</Link></div><p className="leading-7 text-muted-foreground">List continues to marketplace checks before publication. Review the category, specifics, policies and final submission. Save for later keeps this item in Draft.</p></div>
    {draft.warnings.length > 0 && <details className="swish-card p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Evidence and details needing review ({draft.warnings.length})</summary><ul className="list-inside list-disc space-y-2 leading-7 text-muted-foreground">{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
  </section>;
}
