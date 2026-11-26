import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { listingNicheId } from '@/lib/listingSubmission';
import { lookupScopedListingCategory } from '@/lib/scopedCategoryLookup';
import { asRecord } from '@/lib/itemPhotos';
import { coinListingInput } from '@/lib/coinListingInput';
import { retainedCoinIdentitySpecifics } from '@/lib/listingCategorySelection';
import { publicationBlock } from '@/lib/listingReadiness';
import { useCoinCategoryAutoselect } from '@/hooks/useCoinCategoryAutoselect';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import type { CategorySuggestion } from '@/lib/categoryLookup';
export function useListingCategorySuggestion(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null) {
  const [busy, setBusy] = useState(false), [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null), [error, setError] = useState('');
  const flight = useRef(false);
  const suggest = async (automatic = false) => {
    const title = String(draft.form.title || '').trim(), revision = draft.revisionRef.current;
    if (title.length < 2 || !userId || !tenantId || busy || flight.current || publicationBlock(draft.form)) {
      if (!automatic) toast.error('Enter a title and open your SWISH workspace first.'); return;
    }
    if (draft.form.publish_claim_id) { if (!automatic) toast.error('Check the original submission before changing its category.'); return; }
    flight.current = true; setBusy(true); setSuggestion(null); setError('');
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      const activeNiche = getActiveNicheId(), nicheId = draft.item ? listingNicheId(draft.item) : activeNiche;
      const attributes = nicheId === 'coins' && draft.item ? coinListingInput(draft.item, draft.formRef.current.item_specifics, title)
        : { ...asRecord(draft.item?.attributes), ...asRecord(draft.item?.attributesConfirmed) };
      const result = await lookupScopedListingCategory({ client, userId, tenantId, nicheId, specialistId: String(draft.item?.specialist_id || ''), title, attributes, isCurrent: () => getActiveNicheId() === activeNiche && draft.revisionRef.current === revision });
      if (getActiveNicheId() !== activeNiche || draft.revisionRef.current !== revision) return;
      const changed = String(draft.formRef.current.category_id || '') !== result.id;
      const retained = nicheId === 'coins' ? retainedCoinIdentitySpecifics(draft.formRef.current.item_specifics) : {};
      setSuggestion(result); draft.change('category', result.name); draft.change('category_id', result.id); draft.change('category_path', result.categoryPath || '');
      if (changed) { draft.change('condition_id', ''); draft.change('item_specifics', retained); }
      toast.success(changed ? 'Relevant eBay category selected. Check its condition and required specifics, then save.' : 'eBay category checked. Save and review before publishing.');
    } catch (cause) {
      if (draft.revisionRef.current === revision) {
        const message = cause instanceof Error ? cause.message : 'Could not suggest an eBay category';
        setError(message); if (!automatic) toast.error(message);
      }
    } finally { flight.current = false; setBusy(false); }
  };
  useCoinCategoryAutoselect(draft, userId, tenantId, busy, suggest);
  return { busy, suggestion, error, suggest };
}
