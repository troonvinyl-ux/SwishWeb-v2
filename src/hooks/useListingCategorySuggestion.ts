import { useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import { listingNicheId } from '@/lib/listingSubmission';
import { getActiveNicheId } from '@/lib/niche';
import { lookupScopedListingCategory } from '@/lib/scopedCategoryLookup';
import { asRecord } from '@/lib/itemPhotos';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
export function useListingCategorySuggestion(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null) {
  const [busy, setBusy] = useState(false), [suggestion, setSuggestion] = useState<{ id: string; name: string } | null>(null);
  const suggest = async () => {
    const title = String(draft.form.title || '').trim(), revision = draft.revisionRef.current;
    if (title.length < 2 || !userId || !tenantId || busy) { toast.error('Enter a title and open your SWISH workspace first.'); return; }
    setBusy(true); setSuggestion(null);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      const nicheId = draft.item ? listingNicheId(draft.item) : getActiveNicheId();
      await activateModuleScope(client, userId, tenantId, nicheId);
      const result = await lookupScopedListingCategory({ client, userId, tenantId, nicheId, title, attributes: asRecord(draft.item?.attributes), isCurrent: () => getActiveNicheId() === nicheId && draft.revisionRef.current === revision });
      if (draft.revisionRef.current !== revision) return;
      setSuggestion(result); draft.change('category', result.name); draft.change('category_id', result.id);
      toast.success('Category selected. Submit will save it automatically.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not suggest an eBay category'); }
    finally { setBusy(false); }
  };
  return { busy, suggestion, suggest };
}
