import { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { listingConflicts } from '@/lib/listingConflicts';
import ListingConflictQuestion from '@/components/features/ListingConflictQuestion';
import type { ListingConflict, ListingConflictAnswer } from '@/types/listingConflict';
interface ListingConflictReviewProps { form: Record<string, unknown>; item: Record<string, unknown> | null; messages: string[]; disabled: boolean; onResolve: (conflict: ListingConflict, answer: ListingConflictAnswer) => Promise<void>; }
export default function ListingConflictReview({ form, item, messages, disabled, onResolve }: ListingConflictReviewProps) {
  const conflicts = useMemo(() => listingConflicts(form, item, messages), [form, item, messages]);
  if (!conflicts.length) return null;
  return <section className="swish-card space-y-4 p-4 sm:p-5" aria-label="Resolve conflicting listing facts"><h2 className="flex items-center gap-3 text-lg font-semibold"><ListChecks size={22} className="shrink-0 text-warning" />Confirm the correct information</h2><p className="text-base leading-7 text-muted-foreground">Answer only what disagrees. SWISH retains your category, condition, original photos and all unrelated listing details.</p>{conflicts.map(conflict => <ListingConflictQuestion key={`${conflict.id}:${conflict.detail}`} conflict={conflict} disabled={disabled} onResolve={onResolve} />)}</section>;
}
