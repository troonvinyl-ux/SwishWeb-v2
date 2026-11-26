import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { recordRapidCoinCorrection } from '@/lib/rapidCoinLearning';
import type { RapidCoinJob } from '@/types/rapidCoin';
const schema = z.object({ title: z.string().trim().min(3).max(80), notes: z.string().trim().min(3).max(2000), confirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm the correction against your actual coin.' }) }) });
interface RapidCoinCorrectionProps { job: RapidCoinJob; }
export default function RapidCoinCorrection({ job }: RapidCoinCorrectionProps) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { title: job.draft?.title || '', notes: '' } });
  const submit = async (values: z.infer<typeof schema>) => {
    const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend unavailable.');
    await recordRapidCoinCorrection({ client, userId: job.userId, tenantId: job.tenantId, nicheId: 'coins', sessionId: job.id, isCurrent: () => getActiveNicheId() === 'coins' }, job, values.title, values.notes);
    toast.success('Seller-confirmed correction recorded in the shared learning engine');
  };
  return <form className="space-y-3" onSubmit={form.handleSubmit(values => submit(values).catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Correction was not saved.')))}>
    <h3 className="font-semibold">Record a confirmed correction</h3><p className="leading-7">This records evidence for future identification; change buyer copy separately in Edit. Unsold asking prices and AI guesses are not confirmed learning examples.</p>
    <label className="block">Confirmed identity<input className="input-field mt-2" {...form.register('title')} /></label><label className="block">Correction and catalogue evidence<textarea className="input-field mt-2" rows={3} {...form.register('notes')} /></label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" {...form.register('confirmed')} />I verified these corrections against the physical coin and supporting evidence.</label>
    {Object.values(form.formState.errors).map((error, index) => <p role="alert" key={index} className="flex items-center gap-2"><AlertCircle size={18} />{error.message}</p>)}
    <button type="submit" className="btn-secondary min-h-11" disabled={form.formState.isSubmitting}>{job.feedbackId ? 'Check / retry retained correction' : 'Record confirmed correction'}</button>
  </form>;
}
